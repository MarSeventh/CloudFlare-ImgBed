# SDD Progress: AI Metadata Pipeline Refactor

Plan: docs/superpowers/plans/2026-07-20-ai-metadata-pipeline-refactor.md
Branch: dev
Base commit: 1e2156db0c03b50c7427de3f2f8693a90672c210

## Tasks

- [x] Task 1: AI 运行时检测器 (functions/ai/env/detector.js) — commit 7b43bee
- [x] Task 2: AI 环境适配层 (functions/ai/env/adapter.js) — commit 7b43bee
- [x] Task 3: MetadataPatch 契约 (functions/ai/patch/index.js) — commit 13d643b
- [x] Task 4: Processor 基类 + TagProcessor — commit 73ee3db
- [x] Task 5: Metadata Service（抽取唯一写库者）— commit 4f78f93
- [x] Task 6: 把 executeAI 的 tagging 步骤接入 TagProcessor — commit 2810118
- [x] Task 7: 降级路径验证 — test-only（test/ 被忽略，无提交），37 passing

## Notes

- test/ 目录被 .gitignore 忽略（沿用仓库约定，与 docs 同）。测试文件只在本地运行，不提交。
- 每个任务只提交 functions/ai/ 下的生产代码。

## 已完成骨架 — 后续接入指引

- 分层已就位：env(detector/adapter) → patch → processors(base + tag) → services(MetadataService，唯一写库者)。
- 行为保持：tag 仍走 MetadataService → metadata.Tags 合并路径；对外可观测行为与基线一致，全套 37 tests 绿。
- **Patch 层目前是脚手架、非承重**：TagProcessor 返回 { patch, result }，但 Task 6 只消费 result（provider envelope），mergeMetadataPatches 暂无调用者。
  新增 caption/color/nsfw 等能力时，应让 Pipeline 收集各 Processor 的 patch → mergeMetadataPatches 聚合 → 交由 MetadataService 决定字段落点（避免直写 /file 暴露与 KV 1024B 限制）。
- Task 5 的提交（4f78f93）连带纳入了会话前已存在于工作树的队列集成改动（enqueueUploadAI/executeQueuedAI 等）。文件自洽、队列测试通过；如需拆分历史可在 dev 上 rebase。
