#!/usr/bin/env bash

set -Eeuo pipefail

MODE="${1:-check}"
UPSTREAM_REPO="${UPSTREAM_REPO:-MarSeventh/CloudFlare-ImgBed}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
MANIFEST_PATH="${BREAKING_UPDATE_MANIFEST:-.github/breaking-updates.json}"
PENDING_FILE="${RUNNER_TEMP:-/tmp}/cloudflare-imgbed-pending-breaking-updates.txt"
ISSUE_TITLE_PREFIX="CloudFlare-ImgBed Update"

append_summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$1" >> "$GITHUB_STEP_SUMMARY"
  fi
}

set_output() {
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"
  fi
}

issue_title() {
  local update_id="$1"
  printf '[%s: %s] 重要兼容性更新需确认 / Important compatibility update confirmation required' \
    "$ISSUE_TITLE_PREFIX" "$update_id"
}

find_issue() {
  local update_id="$1"
  local prefix="[$ISSUE_TITLE_PREFIX: $update_id]"
  local result

  result="$(
    gh issue list \
      --repo "$GITHUB_REPOSITORY" \
      --state all \
      --limit 1000 \
      --json number,state,title \
      --jq "[.[] | select(.title | startswith(\"$prefix\"))][0] | if . then \"\\(.number)\\t\\(.state)\" else empty end" \
      2>/dev/null || true
  )"

  printf '%s' "$result"
}

close_notice_if_open() {
  local update_id="$1"
  local record issue_number issue_state close_message

  record="$(find_issue "$update_id")"
  [[ -n "$record" ]] || return 0

  IFS=$'\t' read -r issue_number issue_state <<< "$record"
  [[ "$issue_state" == "OPEN" ]] || return 0

  close_message=$'该项更新已完成同步，本通知现自动关闭。感谢您的确认与配合。如更新后遇到问题，欢迎通过公告中提供的渠道反馈。\n\nThis update has been synchronized successfully, so this notice is now being closed automatically. Thank you for your confirmation and cooperation. If you encounter any issues after the update, please use the support channel provided in the announcement.'

  gh issue comment "$issue_number" \
    --repo "$GITHUB_REPOSITORY" \
    --body "$close_message" \
    >/dev/null 2>&1 || true

  gh issue close "$issue_number" \
    --repo "$GITHUB_REPOSITORY" \
    --reason completed \
    >/dev/null 2>&1 || true
}

render_issue_body() {
  local update_json="$1"
  local body_file="$2"
  local update_id title_zh title_en summary_zh summary_en
  local announcement_url migration_url actions_url

  update_id="$(jq -r '.id' <<< "$update_json")"
  title_zh="$(jq -r '.title.zh // "未提供中文标题"' <<< "$update_json")"
  title_en="$(jq -r '.title.en // "English title not provided"' <<< "$update_json")"
  summary_zh="$(jq -r '.summary.zh // "请查阅更新公告以了解完整变更内容。"' <<< "$update_json")"
  summary_en="$(jq -r '.summary.en // "Please refer to the update announcement for complete details."' <<< "$update_json")"
  announcement_url="$(jq -r '.announcementUrl // empty' <<< "$update_json")"
  migration_url="$(jq -r '.migrationUrl // empty' <<< "$update_json")"
  actions_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/workflows/sync-upstream.yml"

  if [[ -z "$announcement_url" ]]; then
    announcement_url="${GITHUB_SERVER_URL:-https://github.com}/${UPSTREAM_REPO}/releases"
  fi

  {
    printf '@%s\n\n' "$GITHUB_REPOSITORY_OWNER"
    printf '## 重要更新通知 / Important Update Notice\n\n'
    printf '您好！感谢您持续使用并维护 CloudFlare-ImgBed。我们检测到上游已准备发布或已经发布一项可能影响现有部署的兼容性变更。为尽可能避免未经确认的配置调整、数据迁移或服务中断，本仓库的定时自动同步已暂时暂停。\n\n'
    printf 'Hello, and thank you for continuing to use and maintain CloudFlare-ImgBed. We detected an upstream compatibility update that is being prepared or has already been released and may affect existing deployments. To help avoid unconfirmed configuration changes, data migrations, or service interruptions, scheduled synchronization for this repository has been temporarily paused.\n\n'
    printf '### 更新信息 / Update Information\n\n'
    printf -- '- 更新编号 / Update ID: `%s`\n' "$update_id"
    printf -- '- 中文标题：%s\n' "$title_zh"
    printf -- '- English title: %s\n\n' "$title_en"
    printf '#### 中文说明\n\n%s\n\n' "$summary_zh"
    printf '#### English Summary\n\n%s\n\n' "$summary_en"

    if jq -e '.changes.zh | type == "array" and length > 0' <<< "$update_json" >/dev/null 2>&1; then
      printf '### 可能涉及的变化\n\n'
      jq -r '.changes.zh[] | "- " + .' <<< "$update_json"
      printf '\n'
    fi

    if jq -e '.changes.en | type == "array" and length > 0' <<< "$update_json" >/dev/null 2>&1; then
      printf '### Potential Impact\n\n'
      jq -r '.changes.en[] | "- " + .' <<< "$update_json"
      printf '\n'
    fi

    printf '### 相关链接 / Related Links\n\n'
    printf -- '- 更新公告 / Update announcement: %s\n' "$announcement_url"
    if [[ -n "$migration_url" ]]; then
      printf -- '- 迁移指南 / Migration guide: %s\n' "$migration_url"
    fi
    printf '\n'
    printf '### 后续操作 / Next Steps\n\n'
    printf '建议您先阅读公告、检查兼容性要求并备份重要数据。准备完成后，请打开下方 Actions 页面，点击 **Run workflow**，勾选确认选项后手动执行同步：\n\n'
    printf 'Please review the announcement, verify the compatibility requirements, and back up important data first. When ready, open the Actions page below, select **Run workflow**, confirm the acknowledgement option, and start the synchronization manually:\n\n'
    printf '%s\n\n' "$actions_url"
    printf '> 在您明确确认前，定时任务不会应用此项更新。手动关闭本 Issue 不会被视为确认；若更新仍未应用，通知可能会再次打开。\n\n'
    printf '> The scheduled workflow will not apply this update until you explicitly confirm it. Closing this issue manually is not considered confirmation; the notice may be reopened while the update remains unapplied.\n\n'
    printf '感谢您的理解与配合。\n\nThank you for your understanding and cooperation.\n\n'
    printf '<!-- cloudflare-imgbed-breaking-update:%s -->\n' "$update_id"
  } > "$body_file"
}

create_or_update_notice() {
  local update_json="$1"
  local update_id title body_file record issue_number issue_state current_json
  local current_title current_body desired_body issue_url owner_type reopen_message

  update_id="$(jq -r '.id' <<< "$update_json")"
  title="$(issue_title "$update_id")"
  body_file="$(mktemp)"
  render_issue_body "$update_json" "$body_file"
  desired_body="$(<"$body_file")"
  record="$(find_issue "$update_id")"

  if [[ -n "$record" ]]; then
    IFS=$'\t' read -r issue_number issue_state <<< "$record"
    current_json="$(gh issue view "$issue_number" --repo "$GITHUB_REPOSITORY" --json title,body 2>/dev/null || true)"
    current_title="$(jq -r '.title // empty' <<< "$current_json" 2>/dev/null || true)"
    current_body="$(jq -r '.body // empty' <<< "$current_json" 2>/dev/null || true)"

    if [[ "$current_title" != "$title" || "$current_body" != "$desired_body" ]]; then
      gh issue edit "$issue_number" \
        --repo "$GITHUB_REPOSITORY" \
        --title "$title" \
        --body-file "$body_file" \
        >/dev/null 2>&1 || true
    fi

    if [[ "$issue_state" == "CLOSED" ]]; then
      reopen_message=$'检测到该兼容性更新尚未应用，因此本通知已自动重新打开。完成准备后，请通过 Actions 工作流明确确认并执行同步。\n\nThis compatibility update has not yet been applied, so the notice has been reopened automatically. When ready, please explicitly confirm and run the synchronization from the Actions workflow.'
      gh issue reopen "$issue_number" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1 || true
      gh issue comment "$issue_number" \
        --repo "$GITHUB_REPOSITORY" \
        --body "$reopen_message" \
        >/dev/null 2>&1 || true
    fi

    rm -f "$body_file"
    printf '%s/issues/%s' "${GITHUB_SERVER_URL:-https://github.com}/$GITHUB_REPOSITORY" "$issue_number"
    return 0
  fi

  if ! issue_url="$(
    gh issue create \
      --repo "$GITHUB_REPOSITORY" \
      --title "$title" \
      --body-file "$body_file" \
      2>/dev/null
  )"; then
    echo "::warning::无法在当前仓库创建更新通知 Issue。请确认仓库已启用 Issues，并允许 GitHub Actions 写入 Issues。" >&2
    echo "::warning::Unable to create the update notice issue. Make sure Issues are enabled and GitHub Actions has issue write permission." >&2
    rm -f "$body_file"
    return 0
  fi

  issue_number="${issue_url##*/}"
  owner_type="$(gh api "repos/$GITHUB_REPOSITORY" --jq '.owner.type' 2>/dev/null || true)"
  if [[ "$owner_type" == "User" ]]; then
    gh issue edit "$issue_number" \
      --repo "$GITHUB_REPOSITORY" \
      --add-assignee "$GITHUB_REPOSITORY_OWNER" \
      >/dev/null 2>&1 || true
  fi

  rm -f "$body_file"
  printf '%s' "$issue_url"
}

validate_update() {
  local update_json="$1"
  local update_id introduced_commit

  update_id="$(jq -r '.id // empty' <<< "$update_json")"
  introduced_commit="$(jq -r '.introducedCommit // empty' <<< "$update_json")"

  if [[ ! "$update_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "Invalid breaking update id: $update_id" >&2
    return 1
  fi

  if [[ -n "$introduced_commit" && ! "$introduced_commit" =~ ^[0-9a-fA-F]{40}$ ]]; then
    echo "Invalid introducedCommit for breaking update $update_id" >&2
    return 1
  fi
}

check_updates() {
  local upstream_remote="cloudflare-imgbed-upstream"
  local upstream_ref="refs/remotes/$upstream_remote/$UPSTREAM_BRANCH"
  local upstream_url="${UPSTREAM_GIT_URL:-${GITHUB_SERVER_URL:-https://github.com}/${UPSTREAM_REPO}.git}"
  local manifest_file update_json update_id introduced_commit issue_url
  local blocked=false allow_breaking_update=false

  if [[ "${ALLOW_BREAKING_UPDATE:-false}" == "true" ]]; then
    allow_breaking_update=true
  fi

  : > "$PENDING_FILE"
  set_output blocked false

  git remote remove "$upstream_remote" >/dev/null 2>&1 || true
  git remote add "$upstream_remote" "$upstream_url"
  git fetch --quiet --no-tags "$upstream_remote" \
    "+refs/heads/$UPSTREAM_BRANCH:$upstream_ref"

  manifest_file="$(mktemp)"
  if ! git show "$upstream_ref:$MANIFEST_PATH" > "$manifest_file" 2>/dev/null; then
    echo "Breaking update manifest not found at $UPSTREAM_REPO:$UPSTREAM_BRANCH/$MANIFEST_PATH" >&2
    rm -f "$manifest_file"
    return 1
  fi

  if ! jq -e '(.schemaVersion == 1) and (.updates | type == "array")' "$manifest_file" >/dev/null; then
    echo "Invalid breaking update manifest: $MANIFEST_PATH" >&2
    rm -f "$manifest_file"
    return 1
  fi

  while IFS= read -r update_json; do
    validate_update "$update_json"
    update_id="$(jq -r '.id' <<< "$update_json")"
    introduced_commit="$(jq -r '.introducedCommit // empty' <<< "$update_json")"

    if [[ -n "$introduced_commit" ]] \
      && git cat-file -e "${introduced_commit}^{commit}" 2>/dev/null \
      && git merge-base --is-ancestor "$introduced_commit" "$upstream_ref" 2>/dev/null \
      && git merge-base --is-ancestor "$introduced_commit" HEAD 2>/dev/null; then
      close_notice_if_open "$update_id"
      continue
    fi

    printf '%s\n' "$update_id" >> "$PENDING_FILE"
    issue_url="$(create_or_update_notice "$update_json")"
    blocked=true

    if [[ "$allow_breaking_update" == "true" ]]; then
      append_summary "### ✅ 已确认兼容性更新 / Compatibility update confirmed"
    else
      append_summary "### ⏸️ 自动同步已暂停 / Automatic synchronization paused"
    fi
    append_summary "- 更新编号 / Update ID: \`$update_id\`"
    if [[ -n "$issue_url" ]]; then
      append_summary "- 通知 / Notice: $issue_url"
    fi
  done < <(jq -c '.updates[] | select(.enabled != false)' "$manifest_file")

  rm -f "$manifest_file"

  if [[ "$blocked" == "true" && "$allow_breaking_update" != "true" ]]; then
    set_output blocked true
    append_summary ""
    append_summary "请阅读通知并通过手动工作流明确确认后再执行更新。"
    append_summary "Please review the notice and explicitly confirm the update through the manual workflow."
    return 0
  fi

  if [[ "$blocked" == "true" && "$allow_breaking_update" == "true" ]]; then
    append_summary ""
    append_summary "已收到手动确认，本次运行将继续同步并在成功后关闭通知。 / Manual confirmation received; synchronization will continue and the notice will be closed after a successful run."
  fi

  set_output blocked false
}

complete_updates() {
  local update_id

  [[ -f "$PENDING_FILE" ]] || return 0

  while IFS= read -r update_id; do
    [[ -n "$update_id" ]] || continue
    close_notice_if_open "$update_id"
  done < "$PENDING_FILE"
}

case "$MODE" in
  check)
    check_updates
    ;;
  complete)
    complete_updates
    ;;
  *)
    echo "Usage: $0 [check|complete]" >&2
    exit 2
    ;;
esac
