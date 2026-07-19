# AI subsystem

This directory is the repository-native extension boundary for the optional AI
pipeline described in `docs/rfc/RFC-0001-AI-Pipeline.md`.

## Current stage

The first implementation stage defines contracts only:

- `artifact/` contains a storage-neutral file input shape.
- `hooks/` contains an isolated lifecycle hook registry.
- `pipeline/` contains provider-neutral step orchestration.
- `provider/` contains the common provider interface.
- `result/` contains the bounded AI result envelope.
- `task/` contains task identity and lifecycle fields.
- `types/` contains shared capabilities, statuses, and error categories.

No provider is constructed, no hook is registered, no configuration or
database is read, and no upload or API path imports this subsystem yet. AI is
therefore disabled without changing existing behavior.

## Planned boundaries

Future stages may add `config/`, `metadata/`, and `utils/` modules. They must
consume these contracts without coupling providers to Telegram, R2, S3,
WebDAV, Hugging Face, or Discord APIs.

## Configuration

Configuration is not read by this stage. Future configuration must use the
existing `functions/utils/sysConfig.js` loader, keep AI disabled by default,
and preserve deployment environment variables as defaults rather than creating
a parallel configuration system.

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

Provider capabilities use action-oriented identifiers such as `tagging`,
`color`, and `object_detection`. Result property names are defined separately
by the result envelope and future capability-specific result contracts.
