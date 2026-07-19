# AI subsystem

This directory is the repository-native extension boundary for the optional AI
pipeline described in `docs/rfc/RFC-0001-AI-Pipeline.md`.

## Current stage

The first implementation stage defines contracts only:

- `artifact/` contains a storage-neutral file input shape.
- `factory/` contains explicit Provider registration and construction.
- `hooks/` contains an isolated lifecycle hook registry.
- `pipeline/` contains provider-neutral step orchestration.
- `provider/` contains the common provider interface.
- `result/` contains the bounded AI result envelope.
- `task/` contains task identity and lifecycle fields.
- `types/` contains shared capabilities, statuses, and error categories.

No provider is constructed automatically, no hook is registered, and no upload
or API path imports this subsystem yet. AI is therefore disabled without
changing existing upload behavior.

## Planned boundaries

Future stages may add `config/`, `metadata/`, and `utils/` modules. They must
consume these contracts without coupling providers to Telegram, R2, S3,
WebDAV, Hugging Face, or Discord APIs.

## Configuration

AI configuration is loaded explicitly through `fetchAIConfig()` in the existing
`functions/utils/sysConfig.js` loader. Database settings use
`manage@sysConfig@ai` and override deployment environment defaults. AI remains
disabled by default.

WD Tagger environment defaults are `WD_TAGGER_ENDPOINT`,
`WD_TAGGER_API_KEY`, `WD_TAGGER_MODEL`, `WD_TAGGER_MODEL_VERSION`,
`WD_TAGGER_THRESHOLD`, `WD_TAGGER_MAX_TAGS`, `WD_TAGGER_MAX_INPUT_SIZE`,
`WD_TAGGER_REQUEST_FORMAT`, and `WD_TAGGER_FILE_FIELD`. Shared defaults use
`AI_ENABLE`, `AI_TIMEOUT`, and `AI_TAGGING_PROVIDER`.

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

Pipeline output is an in-memory execution result only. This stage does not
select Providers, retry calls, persist tasks, merge metadata, register hooks,
or connect the pipeline to Upload.

`createAIFactory()` returns an isolated `AIFactory` with `wd_tagger`
registered. It creates `WDTaggerProvider` only when requested. The Provider
supports the `tagging` capability and returns the common `AIResult` envelope.
It uses the project's existing console logger and does not log credentials,
request bodies, response bodies, or image content.

The configured WD Tagger endpoint must accept an HTTP `POST`. The default
`raw` format sends image bytes with their MIME type; `multipart` sends the image
using the configured file field. Supported JSON responses include arrays of
`{ label, score }`, a `tags` array or object, `general`, `predictions`, or
`result.tags`. Returned tags are normalized, thresholded, sorted, truncated,
and bounded by `maxTags`.

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
