# AI subsystem

This directory is the repository-native extension boundary for the optional AI
pipeline described in `docs/rfc/RFC-0001-AI-Pipeline.md`.

## Architecture

The subsystem is isolated behind upload hooks and provider-neutral contracts:

- `artifact/` contains a storage-neutral file input shape.
- `factory/` contains explicit Provider registration and construction.
- `hooks/` contains an isolated lifecycle hook registry.
- `pipeline/` contains provider-neutral step orchestration.
- `provider/` contains the common provider interface and, grouped by source,
  the concrete providers (e.g. `provider/huggingface/` for the WD Tagger).
- `queue/` contains the versioned task message, stored-file Artifact reader,
  and Cloudflare Queue consumer.
- `result/` contains the bounded AI result envelope.
- `task/` contains task identity and lifecycle fields.
- `types/` contains shared capabilities, statuses, and error categories.

Upload persists storage and metadata before dispatching AI work. When the
optional `img_queue` binding exists, automatic upload tagging sends a task to
the shared AI queue. Without the binding, or when `send()` fails, the existing
`waitUntil()` direct execution remains available as a backward-compatible
fallback. Manual management tagging remains synchronous.

## Planned boundaries

Future stages may add `config/`, `metadata/`, and `utils/` modules. They must
consume these contracts without coupling providers to Telegram, R2, S3,
WebDAV, Hugging Face, or Discord APIs.

## Configuration

AI configuration is loaded explicitly through `fetchAIConfig()` in the existing
`functions/utils/sysConfig.js` loader. Database settings use
`manage@sysConfig@ai` and override deployment environment defaults. AI remains
disabled by default.

Upload integration resolves the stored setting as well as `AI_ENABLE`, so the
management UI can enable or disable automatic tagging without a redeployment.

WD Tagger environment defaults are `WD_TAGGER_ENDPOINT`,
`WD_TAGGER_API_KEY`, `WD_TAGGER_MODEL`, `WD_TAGGER_MODEL_VERSION`,
`WD_TAGGER_THRESHOLD`, `WD_TAGGER_CHARACTER_THRESHOLD`, `WD_TAGGER_MAX_TAGS`, `WD_TAGGER_MAX_INPUT_SIZE`,
`WD_TAGGER_REQUEST_FORMAT`, and `WD_TAGGER_FILE_FIELD`. Shared defaults use
`AI_ENABLE`, `AI_TIMEOUT`, `AI_PARALLEL`, and `AI_TAGGING_PROVIDER`.

`AI_PARALLEL` controls bounded processing within a delivered Queue batch and
defaults to `1`. It can be set from the existing AI management configuration or
as an environment default, with an allowed range of 1 through 10.

Runtime Queue policy is stored with the existing AI management configuration:

```json
{
  "queue": {
    "enabled": true,
    "fallbackToDirect": true,
    "maxRetries": 3,
    "retryDelaysSeconds": [30, 120, 300],
    "staleAfterSeconds": 3600
  }
}
```

The configuration response also includes the read-only `bindingAvailable`
field. Resource names and bindings remain deployment settings and are never
persisted from the management API. Environment defaults use
`AI_QUEUE_ENABLE`, `AI_QUEUE_FALLBACK_DIRECT`, `AI_QUEUE_MAX_RETRIES`,
`AI_QUEUE_RETRY_DELAYS`, and `AI_QUEUE_STALE_AFTER`.

## Cloudflare Queue

All current and future AI providers share the `img_queue` binding. Messages are
provider-neutral and contain a schema version, task and pipeline identity,
capability, file ID, image URL hint, MIME type, file size, and enqueue time.
Provider endpoints, API keys, headers, and threshold configuration are never
placed in Queue messages. Consumers load the latest AI configuration before
execution.

Create the queue once for a Worker deployment:

```sh
npx wrangler queues create imgqueue
```

For GitHub Actions deployments, add the repository secret
`AI_QUEUE_NAME=imgqueue`. `deploy/worker/generate-toml.js` then adds both the
producer binding and consumer settings. For direct Wrangler deployments,
uncomment the `queues.producers` and `queues.consumers` examples in
`deploy/worker/wrangler.toml`.

The consumer receives batches of up to five messages, processes them serially
by default, and retries timeout, rate-limit, storage, and provider 5xx failures
according to the runtime Queue policy. Invalid input and unsupported files
are acknowledged without retry. A final failure is stored in the per-file AI
task value; no dead-letter queue is required.

Cloudflare Pages Functions cannot consume Queue messages. Pages deployments
should omit `img_queue` and continue using the direct fallback. The complete
producer/consumer path targets the repository's standalone Worker deployment.

Docker deployments use a local `img_queue` adapter backed by the existing
`data/database.sqlite` file. Pending tasks therefore survive container restarts
when the data volume is mounted. The adapter uses the same message schema,
consumer, idempotency rules, concurrency setting, and retry policy as the
Cloudflare Queue path. Set `AI_LOCAL_QUEUE_ENABLE=false` to disable it and use
the direct `waitUntil()` fallback. `AI_LOCAL_QUEUE_POLL_MS` optionally changes
the default 1000 ms poll interval. `AI_QUEUE_NAME` is only used while generating
a Cloudflare Worker deployment configuration.

## Public interface

The aggregate entry point is `functions/ai/index.js`. It currently exports the
contract constants and validators, `AIArtifact`, `AIProvider`, and the
`createArtifact`, `createAIResult`, and `createAITask` factories. Artifact and
task factories reject missing required identity fields. The base provider's
`analyze()` method throws until a concrete provider implements it.

The hook module exports `AI_HOOKS`, `AIHookRegistry`, and
`createAIHookRegistry`. A registry is created explicitly and starts without
handlers. Dispatch is sequential in registration order; handler errors are
reported to the caller. This infrastructure does not import or modify Upload.

The pipeline module exports `AIPipeline`, `createAIPipeline`, and
`createAIPipelineStep`. Steps are injected by the caller and execute without
knowledge of a concrete Provider. A pipeline fixes its ID and version and can
apply limited parallelism, per-step and total timeouts, cancellation, and an
explicit `continue` or `stop` failure policy.

Step executors must observe the supplied `AbortSignal`. A timeout stops the
pipeline from awaiting a step, but JavaScript cannot forcibly terminate an
underlying operation that ignores cancellation. With parallel execution, the
`stop` policy prevents new steps from starting; already running steps finish or
respond to their own cancellation constraints.

Pipeline output remains provider-neutral. The upload integration selects a
Provider through the Factory, while the Queue consumer owns delivery retries,
task idempotency, and bounded AI task-state updates around each execution.

`createAIFactory()` returns an isolated `AIFactory` with `wd_tagger`
registered. Passing `{ adapter }` injects the AI environment adapter into every
provider it constructs. It creates `WDTaggerProvider` only when requested. The
Provider supports the `tagging` capability and returns the common `AIResult`
envelope. It uses the project's existing console logger and does not log
credentials, request bodies, response bodies, or image content.

Following the environment-adapter architecture, the Provider routes inference by
runtime. When the operator configures a `@cf/...` model id and the deployment
binds Workers AI as `env.AI`, inference runs natively through `env.AI.run(...)`.
Otherwise, or whenever an HTTP / Hugging Face Space endpoint is configured, it
uses the remote transport. The adapter is optional; without it the Provider
degrades to the remote transport so existing deployments keep working.

The configured WD Tagger endpoint may be a regular HTTP inference endpoint or a
Hugging Face Space repository URL such as
`https://huggingface.co/spaces/SmilingWolf/wd-tagger`. Space repository URLs are
resolved to their hosted Gradio application and its prediction inputs are
discovered automatically. For regular endpoints, the default `raw` format sends
image bytes with their MIME type; `multipart` sends the image using the
configured file field. Supported JSON responses include arrays of
`{ label, score }`, a `tags` array or object, `general`, `predictions`, or
`result.tags`. Returned tags are normalized, thresholded, sorted, truncated,
and bounded by `maxTags`.

## Upload integration

The existing `endUpload()` completion point dynamically dispatches
`after_metadata_persisted` inside its existing background lifetime. AI errors
are logged and do not change the upload response or stored file availability.

Queued tasks use `fileId` as their authoritative identity and read the latest
metadata before execution. The existing file-serving path is reused through an
internal-only context flag, so visitor block pages and hotlink rules cannot be
mistaken for the source image. This flag is not accepted from a URL, header, or
other HTTP input. The queued path supports regular and size-compliant chunked
images across existing storage providers. External-link uploads remain skipped
until an explicit SSRF-safe policy is added.

Queue delivery is at least once. A stable `taskId` makes redelivery idempotent,
and a queued task cannot overwrite an AI result completed after its own
`queuedAt` timestamp. Enqueue writes a `manage@aiTask@<fileId>` state value
with `status=processing`; success, terminal failure, configuration disablement,
and directory deselection all write a terminal state so files do not remain
indefinitely in processing.

Before saving a result, the integration reads the current file record and
merges only the bounded AI task state value, preserving the current file value
and other metadata fields. Successful tags are additionally merged into the existing
`metadata.Tags` array via `mergeTags(..., 'add')`, so AI tags are searchable and
displayed through the existing tag system. Provider-specific tags that contain
characters the tag validator rejects — such as character labels like
`artoria_pendragon_(fate)` — are sanitized into valid tags first rather than
being dropped. The task state value is internal coordination state and is not
returned by file metadata APIs, so providers, models, and task bookkeeping never
appear in API output. KV metadata remains bounded to its 1024-byte limit; AI tags
are added only while the resulting UTF-8 metadata stays within that limit. KV has
no atomic metadata compare-and-swap operation, so this merge is best-effort if
another writer updates the same record at the exact write boundary.

## Example

```js
import { AIProvider, createArtifact, createAIResult } from './index.js';

const artifact = createArtifact({ fileId: 'example' });
const provider = new AIProvider();
const result = createAIResult();
```

```js
import { AI_HOOKS, createAIHookRegistry } from './index.js';

const hooks = createAIHookRegistry();
const unregister = hooks.register(AI_HOOKS.AFTER_METADATA_PERSISTED, handler);
await hooks.dispatch(AI_HOOKS.AFTER_METADATA_PERSISTED, payload, context);
unregister();
```

```js
import { createAIPipeline } from './index.js';

const pipeline = createAIPipeline({
    pipelineId: 'default',
    pipelineVersion: '1',
    steps: [{
        id: 'describe',
        capability: 'description',
        execute: async ({ artifact, signal }) => ({ artifact, signal })
    }]
});

const execution = await pipeline.run({ artifact });
```

```js
import { AI_PROVIDER_NAMES, createAIFactory } from './index.js';
import { fetchAIConfig } from '../utils/sysConfig.js';

const aiConfig = await fetchAIConfig(env);
const factory = createAIFactory();
const provider = factory.create(
    AI_PROVIDER_NAMES.WD_TAGGER,
    aiConfig.providers.wdTagger
);
const result = await provider.analyze(artifact, 'tagging', { signal });
```

Provider capabilities use action-oriented identifiers such as `tagging`,
`color`, and `object_detection`. Result property names are defined separately
by the result envelope and future capability-specific result contracts.
