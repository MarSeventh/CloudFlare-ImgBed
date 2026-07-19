# AI subsystem

This directory is the repository-native extension boundary for the optional AI
pipeline described in `docs/rfc/RFC-0001-AI-Pipeline.md`.

## Current stage

The first implementation stage defines contracts only:

- `artifact/` contains a storage-neutral file input shape.
- `provider/` contains the common provider interface.
- `result/` contains the bounded AI result envelope.
- `task/` contains task identity and lifecycle fields.
- `types/` contains shared capabilities, statuses, and error categories.

All methods are placeholders. No provider is constructed, no configuration or
database is read, and no upload or API path imports this subsystem yet. AI is
therefore disabled without changing existing behavior.

## Planned boundaries

Future stages may add `config/`, `pipeline/`, `hooks/`, `metadata/`, and
`utils/` modules. They must consume these contracts without coupling providers
to Telegram, R2, S3, WebDAV, Hugging Face, or Discord APIs.

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

## Example

```js
import { AIProvider, createArtifact, createAIResult } from './index.js';

const artifact = createArtifact({ fileId: 'example' });
const provider = new AIProvider();
const result = createAIResult();
```

Provider capabilities use action-oriented identifiers such as `tagging`,
`color`, and `object_detection`. Result property names are defined separately
by the result envelope and future capability-specific result contracts.
