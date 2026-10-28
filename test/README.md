# Backend regression tests

This directory organizes regression tests by functionality and serves as the starting point for future coverage. MIME and input-format edge cases belong in the relevant business module; shared file-type and extension rules have their own suite to avoid duplicate assertions.

**Whenever test files, cases or helpers are added, removed, renamed or changed, update this README in the same PR.** Review the affected module descriptions, coverage, limits and execution instructions against the final behavior. This also applies to changes in helpers or CI checks. Review the code and overview together; unrelated wording changes do not replace checking their accuracy.

## Running the checks

Use Node.js 22 and the repository's existing Mocha setup from the main repository root:

```sh
npm ci
npm test
npm run test:server
npx --no-install wrangler pages functions build functions --outdir data/ci-pages-build
```

`npm test` requires neither a running server nor cloud credentials. Tests use isolated in-memory databases and storage doubles. They do not read or write application data in `data/` or contact real storage services.

Run a single module or filter by a test name:

```sh
npm test -- test/upload.test.js
npm test -- test/read.test.js
npm test -- test/delete.test.js
npm test -- test/update.test.js
npm test -- test/update.test.js --grep "rename"
```

The current Mocha entry point automatically loads `.js` test files directly inside `test/`. Files in `helpers/` are not standalone suites; `smoke/serverImports.mjs` runs separately through `npm run test:server`. When adding suites in subdirectories, update test discovery and confirm CI finds them.

## Module overview

| Module | Test file | Production entry points | Covered behavior |
| --- | --- | --- | --- |
| Upload | [upload.test.js](upload.test.js) | `functions/upload/` | Upload permissions and IP blocking; directory cleanup and original-name collision avoidance; R2/S3/WebDAV types and metadata; Telegram special formats and compression settings; R2/S3 multipart initialization, upload and completion; HuggingFace direct upload and commit |
| Reading and querying | [read.test.js](read.test.js) | `functions/file/`, `api/manage/list.js`, `random/` | R2 GET/HEAD/Range and response types; invalid IDs and missing records; external redirects; administrator preview permissions and private caching; listing directory boundaries, pagination, recursion, counts, search and type filters; random-image `content=` compatibility |
| Deletion | [delete.test.js](delete.test.js) | `api/manage/delete/` | R2 deletion and idempotency; single/batch/folder existence results and missing-record index cleanup; partial failures with file and index preservation on storage errors; actual S3 object keys; batch-ID normalization, deduplication and limits; index updates and cache invalidation |
| Duplicate scan | [dedupScan.test.js](dedupScan.test.js) | `api/manage/dedup/scan` | Node capability probe; read-only content grouping and earliest valid timestamp selection; corrupt/missing index and record handling; duplicate index IDs; pending/concurrent index changes; partial reports; actual byte limits and stream cancellation; deadlines covering storage reads and hashing; release of late storage responses even when timers and the wall clock disagree |
| Updates | [update.test.js](update.test.js) | `api/manage/metadata/`, `rename/`, `move/` | Editable metadata fields, preservation of existing data and removal of historical credentials; R2 rename and moves between folders or to root; collisions and invalid requests; source preservation on copy failure; legacy Telegram limitations; real index consistency after updates |
| Authentication and sessions | [auth.test.js](auth.test.js) | `utils/auth/`, `api/manage/_middleware.js` | Old/new password formats, administrator/user separation and unconfigured authentication; token permissions and expiry; authCode sources and precedence; session validity, cookies, TTL and logout; management permission mapping, preflight and caching policies |
| Image processing | [imageProcessing.test.js](imageProcessing.test.js) | `functions/file/imageTransform.js` | Parameter validation, processor format support, historical generic types, original-image fallback, input formats and output headers |
| AI tags | [ai.test.js](ai.test.js) | `api/manage/ai/tags.js` | Original formats, preview-type normalization, signatures and size limits; AI invocation only for valid input |
| Shared file-type rules | [fileTypes.test.js](fileTypes.test.js) | `utils/mimeTypes.js` | MIME normalization, case-sensitive parameters, explicit-type precedence, extension inference, unknown/ambiguous extensions and random-image keywords versus strict classification |
| Deployment runtime | [runtime.test.js](runtime.test.js) | `_middleware.js`, `api/userConfig.js` | Pages default and Node/Worker adapter markers; configured environment values cannot override the platform; frontend runtime field |
| Server imports | [smoke/serverImports.mjs](smoke/serverImports.mjs) | Main routes above and `functions/dav/` | Unmodified route imports and handler exports through the production loader |

Business paths in the table are relative to `functions/`, except those already starting with `functions/`. Extend the relevant suite when changing one feature. A substantial independent feature can have its own module; add its entry points, scope and boundaries here instead of accumulating unrelated behavior in one file.

### Current coverage limits

- Upload tests cover the channel behavior listed above, not every channel's rate limits, retries, interruption recovery or automatic failover.
- File-content tests primarily cover R2. Listing tests use the real index and management API, but do not fully cover index rebuilding, corruption recovery, all tag filters or every database adapter.
- Deletion tests exercise single-file, batch and nested-folder handlers with real index operations. Folder listings and storage responses are mocked; the suite does not exercise recursive listing over HTTP or every remote channel's failure semantics.
- Updates cover metadata and individual R2 renames/moves, not recursive directory moves, migrations across all channels or recovery from every intermediate failure.
- Image processing, AI and random-image tests cover the behavior listed above. Extend their suites when those features change.
- Storage requests, cache invalidation and AI calls use doubles. There are no live cloud end-to-end tests, complete Docker image startup checks, browser UI tests or production Cloudflare deployment checks.

Keep gaps explicit here until the corresponding tests exist. Passing CI does not establish that every basic capability has been verified.

## Helpers and isolation boundaries

| Helper | Purpose and limits |
| --- | --- |
| [helpers/loadFunction.js](helpers/loadFunction.js) | Replaces named imports in source modules to inject storage, configuration and other dependencies while executing real handlers. MIME imports use the real shared utility. Recheck substitution when production imports change |
| `memoryDatabase()` | Isolated records and metadata per test; metadata reads return copies and listings sort by key. It implements only the interfaces needed by tests and does not verify KV/D1/SQLite pagination, TTL or consistency semantics |
| [helpers/context.js](helpers/context.js) | Builds requests, route parameters and environments, and collects `waitUntil` tasks. Await those tasks before asserting background results; queuing work does not establish successful completion |
| [helpers/files.js](helpers/files.js) | Creates PNG header/dimension samples for header inspection. These samples are not complete, decodable images |
| [helpers/management.js](helpers/management.js) | Shared deletion/update environment with the real index, metadata cleanup and management view; in-memory R2 objects, channel configuration and cache doubles. `readFiles()` awaits background tasks and queries the real index to verify final results |

Authentication tests use the real authentication core, password checks, sessions and token validation, with configuration and database access replaced. Upload/read route tests may replace authentication dependencies to exercise their own entry branches; `auth.test.js` protects the complete authentication boundary.

Isolated loading cannot detect every module-resolution issue. CI therefore also imports routes through the production server loader and builds Pages Functions. When testing a new route, add its real entry point to `smoke/serverImports.mjs` as appropriate and retain both checks.

## Extending and maintaining the suite

1. Choose a module by behavior and specify the expected result. Each case should protect a clear behavior; parameterize related boundaries and use separate files for substantial independent features.
2. Prefer real business code. Inject doubles at configuration, database, storage, cache and AI boundaries rather than replacing the core logic being tested.
3. Assert observable results, including status codes, headers, response data, persisted records, file content and indexes. For deletion/update failures, also verify that original and unrelated data are preserved.
4. Where practical, include a regression that fails before the fix and passes afterward. Retain assertions for previously correct behavior; avoid testing only the new branch or reproducing implementation logic in assertions.
5. Create independent state and restore modified globals. Do not use real credentials, production data, arbitrary fixed delays or external network dependencies. Clean up timer tasks so they cannot hold the process open.
6. **Update this README in the same PR**: module overview, coverage limits and affected helper descriptions. Changes to entry points, dependencies or execution also require updated commands and CI configuration.
7. Run the affected module, then `npm test` and `npm run test:server`. Also build Pages Functions when changing shared production modules, imports or build behavior. Report actual results and unverified environments in the PR.

## CI

The main repository's `.github/workflows/regression.yml` runs on PRs targeting `dev` or `main`, pushes to those branches and manual dispatches. It:

1. Installs dependencies from the lockfile.
2. Runs `npm test`.
3. Runs `npm run test:server`.
4. Builds Pages Functions.

The runner reports test counts; this document maintains functional scope rather than a fixed numeric pass criterion. CI supports code review. Changes that need real channel or deployment validation should describe that verification in the PR.
