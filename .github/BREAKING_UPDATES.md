# Breaking update guard / 破坏性更新保护机制

The scheduled upstream synchronization reads `.github/breaking-updates.json` before applying changes. If an enabled update has not been applied to a fork, automatic synchronization is paused and a bilingual issue is created in that fork.

定时上游同步会在应用变更前读取 `.github/breaking-updates.json`。如果某项已启用的更新尚未包含在用户 Fork 中，自动同步会暂停，并在该 Fork 中创建中英双语 Issue。

## Initial rollout / 首次上线

This feature changes a workflow file. Existing forks may need to use GitHub's **Sync fork** button once before the guard becomes active, because a repository token may not be allowed to update workflow files automatically. Do not publish the first protected breaking update until this rollout has been announced and users have had time to synchronize the new workflow.

此功能本身会修改 workflow 文件。由于仓库令牌可能无权自动更新 workflow，现有 Fork 可能需要先在 GitHub 页面手动点击一次 **Sync fork**，保护机制才会正式生效。在发布第一项受保护的破坏性更新前，应先公告此次上线，并为用户预留同步新 workflow 的时间。

## Manifest format / 清单格式

```json
{
  "schemaVersion": 1,
  "updates": [
    {
      "id": "2026-08-storage-migration",
      "enabled": true,
      "introducedCommit": "0123456789abcdef0123456789abcdef01234567",
      "title": {
        "zh": "存储配置迁移",
        "en": "Storage configuration migration"
      },
      "summary": {
        "zh": "本次更新调整了存储配置格式，更新前请备份现有配置。",
        "en": "This update changes the storage configuration format. Back up the existing configuration before updating."
      },
      "changes": {
        "zh": [
          "部分旧配置项不再兼容",
          "更新后需要检查存储连接"
        ],
        "en": [
          "Some legacy configuration options are no longer compatible",
          "Storage connectivity should be verified after the update"
        ]
      },
      "announcementUrl": "https://github.com/MarSeventh/CloudFlare-ImgBed/releases/tag/v3.0.0",
      "migrationUrl": "https://example.com/migration-guide"
    }
  ]
}
```

Rules / 规则：

- `id` must be stable and contain only letters, numbers, `.`, `_`, or `-`.
- `introducedCommit` should be the full 40-character commit SHA that first introduces the incompatible change.
- If `introducedCommit` is invalid or is not reachable from the upstream branch, the guard remains blocked as a fail-safe.
- An empty `introducedCommit` is a fail-safe release barrier: every fork will remain blocked until the field is updated to a real commit SHA and that commit is synchronized.
- Keep historical entries enabled so forks that have been offline for a long time are still protected. Disable an entry only when crossing that version boundary is safe again.
- `id` 必须保持稳定，并且只能包含字母、数字、`.`、`_` 或 `-`。
- `introducedCommit` 应填写首次引入不兼容变更的完整 40 位 commit SHA。
- 如果 `introducedCommit` 无效或无法从上游分支访问，保护机制会按故障安全原则继续阻断同步。
- 空的 `introducedCommit` 是故障安全发布屏障：在补充真实 commit SHA 且用户完成同步前，所有 Fork 都会继续阻断自动更新。
- 建议长期保留并启用历史记录，以保护长时间未运行的 Fork。只有在跨越该版本边界已恢复安全时才禁用记录。

## Recommended release sequence / 推荐发布顺序

1. Add an enabled manifest entry before merging the breaking change. Leave `introducedCommit` empty if the final SHA is not known yet.
2. Publish the announcement and migration guide.
3. Merge the breaking update.
4. Replace `introducedCommit` with the full SHA of the first incompatible commit as soon as it is available.
5. Keep the entry in the manifest. Forks containing that commit will synchronize normally; older forks will continue to receive the notice.

1. 在合并破坏性变更前，先添加并启用清单记录。如果尚不知道最终 SHA，可暂时将 `introducedCommit` 留空。
2. 发布更新公告和迁移指南。
3. 合并破坏性更新。
4. 获得 SHA 后，尽快将 `introducedCommit` 更新为首个不兼容 commit 的完整 SHA。
5. 保留该清单记录。已经包含此 commit 的 Fork 会正常同步，旧 Fork 则继续收到通知并保持暂停。

Users apply the update by manually running `Upstream Sync` and selecting the confirmation checkbox. Closing the issue manually is not treated as consent; the workflow will reopen it while the update remains unapplied.

用户需要手动运行 `Upstream Sync` 并勾选确认选项来应用更新。手动关闭通知 Issue 不代表同意更新；只要更新仍未应用，工作流就会重新打开该通知。

The fork must have GitHub Issues enabled. If Issues are disabled or repository policy prevents GitHub Actions from writing issues, synchronization is still paused safely and the workflow summary contains a warning, but no issue can be created.

用户 Fork 需要启用 GitHub Issues。如果 Issues 已关闭，或仓库策略不允许 GitHub Actions 写入 Issue，同步仍会安全暂停，并在工作流摘要中显示警告，但无法创建通知 Issue。
