# Contributing to CloudFlare ImgBed

Thank you for contributing code, documentation, tests, ideas or reproducible bug reports. Please follow the project's [Code of Conduct](CODE_OF_CONDUCT.md) when participating.

## Choose the right repository and branch

Submit source changes to the repository responsible for the feature:

| Repository | Scope | PR target |
| --- | --- | --- |
| [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed) | Backend APIs, uploads, file access, storage channels, authentication, database adapters and Pages/Workers/Docker deployment | `dev` |
| [Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub) | Vue UI, interactions, state management, localization, frontend tests and builds | `dev` |
| [CloudFlare-ImgBed-Docs](https://github.com/MarSeventh/CloudFlare-ImgBed-Docs) | VitePress user documentation, deployment guides, API documentation and FAQs | `main` |

- The main repository uses `main` for releases. The frontend's default branch is `master`, but feature and bug-fix PRs still target `dev`.
- Unless a maintainer requests otherwise, create your working branch from the relevant PR target. Avoid including unrelated differences from release branches.
- Submit frontend source changes to the frontend repository. Do not edit bundled scripts in the main repository's `frontend-dist/`; maintainers synchronize frontend artifacts during integration or release.
- Submit user-documentation changes to the documentation repository.
- For changes spanning repositories, open separate, linked PRs. Explain the interface contract, compatibility requirements and suggested merge order. Each PR should have a clear responsibility and reproducible validation steps.

## Before you start

Search existing issues, discussions and PRs to avoid duplicate work. Small fixes can be submitted directly. For significant features, architecture changes, breaking APIs or new dependencies, discuss the problem, proposed approach and compatibility impact in an issue or discussion first.

For a bug report, include:

- Deployment method and version.
- Minimal reproduction steps, expected behavior and actual results.
- Relevant storage channel, browser or file-format details.
- Sanitized logs, screenshots or sample files. Remove secrets, cookies, tokens, private links and personal data.

For security vulnerabilities, check the repository's Security page for reporting options before disclosing exploitable details or credentials in a public issue or PR.

## Local development and validation

Use Node.js 22, npm and the repository's `package-lock.json`. Run each set of commands from the corresponding repository root.

### Main repository

```sh
npm ci
npm start
```

`npm start` runs the local Pages development server on port `8080`, with local state under `data/`. To exercise the Node.js server deployment, use `npm run start:docker`; this runs the server directly and does not build a Docker image. See the [deployment configuration guide](https://cfbed.sanyue.de/en/deployment/configuration) for environment and storage settings.

Before submitting:

```sh
npm test
npm run test:server
npx --no-install wrangler pages functions build functions --outdir data/ci-pages-build
```

- Automated regressions need no running server or cloud credentials. See [test/README.md](test/README.md) for coverage and limits.
- Changes to Docker, Worker entry points, database adapters or specific storage channels may require additional build/runtime checks. Describe the environments actually tested in the PR.

### Frontend repository

```sh
npm ci
npm run serve
```

The frontend uses Vue 3 and Vue CLI. Its development server defaults to port `3000`. When connecting to a local backend, check `VUE_APP_BACKEND_URL` in `.env.development` and the existing proxy rules. Keep personal environment settings out of the PR.

Before submitting:

```sh
npm test
npm run build
```

- See the frontend's [test/README.md](https://github.com/MarSeventh/Sanyue-ImgHub/blob/dev/test/README.md) for test scope and maintenance requirements.
- For UI changes, include useful screenshots or recordings and describe the key interactions and supported devices checked.
- Reuse existing components, themes, state management and localization. Update relevant language resources when changing user-facing text; identify incomplete translations in the PR.

### Documentation repository

```sh
npm ci
npm run docs:dev
npm run docs:build
```

- Pages live in `src/`, English pages in `src/en/`, and navigation/sidebar configuration in `src/.vitepress/config.mts`.
- When adding pages, check navigation, links, image paths, example commands and configuration names.
- For behavior, API or deployment changes, update the corresponding Chinese and English pages where practical. Identify any language version still needing an update.
- Follow the existing structure and terminology. Avoid unrelated whole-page reformatting.

## Follow the existing style and architecture

### Match the surrounding code

- Use implementations in the same directory or feature as a reference for naming, indentation, quotes, semicolons, error handling and exports. Keep the backend's existing ESM conventions and the frontend configuration files' existing module system.
- Avoid mass formatting, renaming or toolchain replacement for personal preference. Structural changes should serve the current task and have a stated reason.
- Use comments to explain design decisions, compatibility constraints and non-obvious boundaries rather than restating code. Follow existing JSDoc conventions for interfaces or complex logic, and the file's existing Chinese/English comment style.
- Remove debugging output, temporary comments, dead branches and machine-specific paths or settings.

### Extend existing boundaries

- Check existing utilities and adapters before adding another implementation. Put logic needed by multiple callers in the appropriate shared module, without creating unnecessary abstractions for a single case.
- Shared backend business code must work across Pages, Workers and the Node.js server. Keep Node-specific filesystem APIs and native dependencies in the relevant deployment adapter, outside shared edge-runtime paths.
- Reuse the authentication core for permissions and database adapters for data access. Keep provider-specific behavior in storage modules. New endpoints should preserve existing permission, configuration and error-response conventions.
- Separate generic tools from business policies. For example, shared MIME normalization/inference does not replace image-processing, AI or upload-channel format allowlists, signature checks or capability limits.
- Before adding dependencies, check whether existing code is sufficient. Explain the need and effects on runtime support, bundle size and deployment. Update manifests and lockfiles only when dependencies actually change.

## Preserve existing correct behavior

When fixing one path, check other callers using the same logic. Keep unrelated behavior outside the change, and verify previously valid inputs, failure paths and edge cases alongside the new scenario.

Pay particular attention to:

- Upload/file-access channel capabilities, multipart and direct uploads, metadata, names, types, response headers, GET/HEAD/Range handling and existing compression policies.
- Administrator/user separation, token permissions, session expiry and the existing behavior when authentication is not configured.
- Historical records that may lack newer fields, and existing user configuration, metadata and files.

Do not silently migrate or overwrite existing data. If a migration or incompatible change is necessary, discuss it first and explain its scope, trigger, failure handling and recovery path.

## Add focused regression tests

For bug fixes or behavior changes, add tests where practical that reproduce the problem, verify the fix and protect existing correct behavior. Complex boundaries and permission checks especially benefit from regressions. Text-only or comment changes do not need tests just to increase the count.

- Use the existing framework and helpers. Organize suites by functionality, such as upload, read, delete, update and authentication. Extend the relevant module or add a file for an independent feature.
- **When adding, removing, renaming or changing tests or helpers, update the affected repository's `test/README.md` in the same PR.** Maintain its module overview, coverage limits, commands and helper descriptions. This requirement applies to both backend and frontend tests.
- Keep tests independent and repeatable, without live cloud services, external network resources, private credentials or arbitrary delays by default.
- Mock storage, configuration and other external boundaries as needed, while exercising the real business logic being verified.
- Report actual commands and results in the PR. Distinguish mocked tests, build checks, manual checks and live-provider validation; identify unverified environments. Passing CI does not establish end-to-end coverage of every deployment or channel.

## Keep PRs atomic

One PR should solve one clear problem or deliver one complete feature, together with its necessary tests and documentation. A maintainer should be able to understand, validate, merge and revert it independently.

- Leave out unrelated fixes, style refactors, dependency upgrades, version bumps and release operations. Split related improvements when they can be delivered independently.
- Keep a complete fix together when splitting it would produce changes that cannot work independently. Discuss a staged approach for larger work; use a draft PR for early feedback.
- Review the final diff and remove test output, build caches, temporary scripts, databases, logs and local configuration. Maintained regression tests belong in the PR; temporary verification files do not.
- Avoid unrelated generated assets. When generated changes are necessary for the task, explain their source and generation command.

Commit titles should preferably follow existing prefixes such as `fix:`, `feat:`, `docs:`, `test:`, `ci:` or `refactor:`, followed by the concrete change. Choose commit boundaries that help review; PRs are not required to contain exactly one commit.

## Describe the final change

Write for a reviewer who has not followed the discussion. Explain the problem, resulting behavior and compatibility impact. A useful PR description is:

```md
## Problem and change
Describe the trigger, previous behavior and resulting behavior.

## Compatibility and related changes
List affected entry points, configuration, historical data and related issues
or PRs in other repositories. Omit this section if it does not apply.

## Validation
- Commands actually run and their results
- Relevant reproduction steps, UI screenshots or provider checks
- Unverified environments or known limits
```

Before opening the PR, confirm the repository and target branch, keep the diff focused and run the relevant checks. Continue responding to review in the same PR, and check CI after further commits. Investigate failures rather than deleting relevant cases or weakening assertions to bypass them.

Maintainers consider correctness, compatibility, architecture consistency and maintenance cost when reviewing contributions. CI provides basic checks; merging still requires code review.
