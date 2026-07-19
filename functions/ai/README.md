# AI subsystem

This directory is the repository-native extension boundary for the optional AI
pipeline described in `docs/rfc/RFC-0001-AI-Pipeline.md`.

## Current stage

The first implementation stage defines contracts only:

- `artifact/` contains a storage-neutral file input shape.
- `hooks/` contains an isolated lifecycle hook registry.
- `provider/` contains the common provider interface.
- `result/` contains the bounded AI result envelope.
- `task/` contains task identity and lifecycle fields.
- `types/` contains shared capabilities, statuses, and error categories.

No provider is constructed, no hook is registered, no configuration or
database is read, and no upload or API path imports this subsystem yet. AI is
therefore disabled without changing existing behavior.

## Planned boundaries

Future stages may add `config/`, `pipeline/`, `metadata/`, and `utils/` modules.
They must consume these contracts without coupling providers to Telegram, R2,
S3, WebDAV, Hugging Face, or Discord APIs.

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

Provider capabilities use action-oriented identifiers such as `tagging`,
`color`, and `object_detection`. Result property names are defined separately
by the result envelope and future capability-specific result contracts.
