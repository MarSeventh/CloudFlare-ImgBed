#!/usr/bin/env python3
"""Maintain and render Star History without a hosted chart service.

The three subcommands form one pipeline:

* ``refresh-data`` extends the public date/count cache with one GitHub
  repository-metadata request per configured repository;
* ``patch-upstream`` seeds a pinned official backend from that local cache;
* ``render`` validates and saves the official localhost-rendered SVG pair.

The official JSDOM, XYChart, xkcd styling, theme logic, and SVGO rendering path
remain unchanged.
"""

from __future__ import annotations

import argparse
import base64
import copy
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


DEFAULT_BACKEND_URL = "http://127.0.0.1:8080"
SCHEMA_VERSION = 2
DATA_FORMAT = "star-history-pages"
THEMES = ("light", "dark")
REPOSITORY_PATTERN = re.compile(
    r"^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?/"
    r"[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$"
)
USER_AGENT = "deploy-star-history-pages local updater"
MAX_JSON_BYTES = 5_000_000
MAX_SVG_BYTES = 5_000_000

# One retry covers a short runner-local startup/readiness race. The backend is
# seeded from local data and therefore performs no stargazers API fan-out.
LOCAL_RENDER_ATTEMPTS = 2
# The fallback fetches the last-deployed pair from this project's Pages CDN,
# where retries usefully ride out short-lived network hiccups.
FALLBACK_RENDER_ATTEMPTS = 4

MAIN_PATH = Path("backend/main.ts")

STARTUP_ORIGINAL = """const startServer = async () => {
  await initTokenFromEnv();
  initOgAssets();
  const repoStore = loadRepos();

  const app = new Hono();"""

STARTUP_PATCHED = """const startServer = async () => {
  const seedPath = process.env.STAR_HISTORY_DATA_PATH;
  if (!seedPath) {
    await initTokenFromEnv();
  }
  initOgAssets();
  const repoStore = loadRepos();

  if (seedPath) {
    const fs = await import("node:fs");
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
    const series = seed.series;
    if (!Array.isArray(series) || series.length === 0) {
      throw new Error("Invalid STAR_HISTORY_DATA_PATH payload");
    }
    for (const item of series) {
      const repository = String(item.repository || "").toLowerCase();
      const starRecords = item.star_records;
      const logoUrl = String(item.logo_url || "");
      if (!repository || !Array.isArray(starRecords) || starRecords.length === 0 || !logoUrl) {
        throw new Error("Invalid STAR_HISTORY_DATA_PATH series");
      }
      cache.set(repository, {
        starRecords,
        starAmount: starRecords[starRecords.length - 1].count,
        logoUrl,
      });
      logger.info(`Loaded ${starRecords.length} local Star History records for ${repository}`);
    }
  }

  const app = new Hono();"""


# ---------------------------------------------------------------------------
# Shared command-line interface
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    refresh = commands.add_parser(
        "refresh-data",
        help="Update the local date/count cache from GitHub repository metadata",
    )
    refresh.add_argument(
        "--repository",
        default=os.environ.get("STAR_HISTORY_REPOSITORIES"),
        required="STAR_HISTORY_REPOSITORIES" not in os.environ,
        help="Comma-separated GitHub repositories in owner/name form",
    )
    refresh.add_argument("--seed-file", type=Path, required=True)
    refresh.add_argument("--deployed-url")
    refresh.add_argument("--output", type=Path, required=True)
    refresh.add_argument(
        "--token-env",
        default="GITHUB_TOKEN",
        help="Environment variable containing a GitHub token",
    )

    patch_parser = commands.add_parser(
        "patch-upstream",
        help="Patch the pinned official backend to load the local cache",
    )
    patch_parser.add_argument(
        "--source-dir",
        type=Path,
        required=True,
        help="Path to the checked-out star-history/star-history source",
    )

    render = commands.add_parser(
        "render",
        help="Save light and dark SVGs produced by the local official backend",
    )
    render.add_argument(
        "--backend-url",
        default=os.environ.get("STAR_HISTORY_BACKEND_URL", DEFAULT_BACKEND_URL),
        help="Local official backend origin (default: %(default)s)",
    )
    render.add_argument(
        "--repository",
        default=os.environ.get("STAR_HISTORY_REPOSITORIES"),
        required="STAR_HISTORY_REPOSITORIES" not in os.environ,
        help="Comma-separated GitHub repositories in owner/name form",
    )
    render.add_argument(
        "--output-dir",
        type=Path,
        default=Path(".star-history-site"),
        help="Directory that receives the two SVG files (default: %(default)s)",
    )
    render.add_argument(
        "--fallback-base-url",
        default=os.environ.get("STAR_HISTORY_FALLBACK_BASE_URL"),
        help=(
            "Base URL containing this project's last deployed light/dark SVG pair"
        ),
    )
    return parser


# ---------------------------------------------------------------------------
# History data cache
# ---------------------------------------------------------------------------


def parse_record_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y/%m/%d %H:%M:%S").replace(
        tzinfo=timezone.utc
    )


def format_record_date(value: datetime) -> str:
    current = value.astimezone(timezone.utc)
    return "{0}/{1}/{2} {3}:{4}:{5}".format(
        current.year,
        current.month,
        current.day,
        current.hour,
        current.minute,
        current.second,
    )


def validate_repository(value: str) -> str:
    repository = value.strip().lower()
    if not REPOSITORY_PATTERN.fullmatch(repository):
        raise ValueError("repository must use GitHub owner/name format")
    return repository


def validate_repositories(value: str) -> Tuple[str, ...]:
    repositories = tuple(validate_repository(item) for item in value.split(","))
    if not repositories or len(set(repositories)) != len(repositories):
        raise ValueError("repositories must be a non-empty unique list")
    return repositories


def _validate_runtime_series(payload: Any, repository: str) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Star History series must be a JSON object")
    if str(payload.get("repository", "")).lower() != repository.lower():
        raise ValueError("Star History series targets a different repository")
    logo_url = payload.get("logo_url")
    if not isinstance(logo_url, str) or not logo_url.startswith("data:image/"):
        raise ValueError("Star History series is missing an embedded logo")

    records = payload.get("star_records")
    if not isinstance(records, list) or len(records) < 2:
        raise ValueError("Star History data requires at least two records")
    previous_date: Optional[datetime] = None
    for record in records:
        if not isinstance(record, dict):
            raise ValueError("Star History record must be an object")
        date_value = record.get("date")
        if not isinstance(date_value, str):
            raise ValueError("Star History record date must be a string")
        date = parse_record_date(date_value)
        count = record.get("count")
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise ValueError("Star History record count must be a non-negative integer")
        if previous_date is not None and date <= previous_date:
            raise ValueError("Star History records must be strictly chronological")
        previous_date = date
    return payload


def validate_data(
    payload: Any, repositories: Tuple[str, ...]
) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Star History data must be a JSON object")
    if payload.get("format") != DATA_FORMAT:
        raise ValueError("unsupported Star History data format")
    if payload.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("unsupported Star History data schema")
    series = payload.get("series")
    if not isinstance(series, list) or len(series) != len(repositories):
        raise ValueError("Star History data must contain every repository")
    for index, repository in enumerate(repositories):
        _validate_runtime_series(series[index], repository)
    updated_at = payload.get("updated_at")
    if not isinstance(updated_at, str):
        raise ValueError("Star History data is missing updated_at")
    datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    return payload


def validate_legacy_seed(
    payload: Any, repositories: Tuple[str, ...]
) -> Dict[str, Any]:
    if not isinstance(payload, dict) or payload.get("schema_version") != 2:
        raise ValueError("legacy Star History seed has an unsupported schema")
    series = payload.get("series")
    if not isinstance(series, list) or len(series) != len(repositories):
        raise ValueError("legacy Star History seed must contain every repository")
    for index, repository in enumerate(repositories):
        item = series[index]
        if not isinstance(item, dict) or str(item.get("repository", "")).lower() != repository:
            raise ValueError("legacy Star History repository order is invalid")
        reconstruction = item.get("reconstruction")
        snapshots = item.get("snapshots")
        if not isinstance(reconstruction, dict) or not isinstance(snapshots, list):
            raise ValueError("legacy Star History series is malformed")
        daily = reconstruction.get("daily")
        if not isinstance(daily, list):
            raise ValueError("legacy Star History reconstruction is malformed")
        for point in daily:
            datetime.fromisoformat(point["date"])
            count = point.get("stars")
            if isinstance(count, bool) or not isinstance(count, int) or count < 0:
                raise ValueError("legacy Star History count is invalid")
        for snapshot in snapshots:
            datetime.fromisoformat(str(snapshot["at"]).replace("Z", "+00:00"))
            count = snapshot.get("stars")
            if isinstance(count, bool) or not isinstance(count, int) or count < 0:
                raise ValueError("legacy Star History snapshot is invalid")
    return payload


def read_json_file(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def download_json(url: str) -> Dict[str, Any]:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("deployed data URL must use HTTPS")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read(MAX_JSON_BYTES + 1)
    if len(body) > MAX_JSON_BYTES:
        raise ValueError("deployed Star History data is unexpectedly large")
    return json.loads(body.decode("utf-8"))


def load_best_data(
    *,
    repositories: Tuple[str, ...],
    seed_file: Path,
    deployed_url: Optional[str],
) -> Tuple[Dict[str, Any], str]:
    if deployed_url:
        try:
            deployed = validate_data(download_json(deployed_url), repositories)
            return deployed, "deployed Pages data"
        except urllib.error.HTTPError as exc:
            try:
                status = exc.code
            finally:
                exc.close()
            if status != 404:
                raise RuntimeError(
                    "deployed Pages cache request failed; preserving the last "
                    "deployment: HTTP {0}".format(status)
                ) from exc
            print("[data] deployed cache not found; using repository seed")
        except (OSError, ValueError, json.JSONDecodeError, urllib.error.URLError) as exc:
            raise RuntimeError(
                "deployed Pages cache is unavailable or invalid; preserving "
                "the last deployment: {0}".format(exc)
            ) from exc
    seed = read_json_file(seed_file)
    try:
        return validate_data(seed, repositories), "repository seed"
    except ValueError:
        return validate_legacy_seed(seed, repositories), "legacy repository seed"


def fetch_repository_metadata(repository: str, token: str) -> Dict[str, Any]:
    url = "https://api.github.com/repos/{0}".format(repository)
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer {0}".format(token),
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    last_error: Optional[Exception] = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            count = payload.get("stargazers_count")
            if isinstance(count, bool) or not isinstance(count, int) or count < 0:
                raise ValueError("GitHub metadata omitted stargazers_count")
            created_at = payload.get("created_at")
            owner = payload.get("owner")
            avatar_url = owner.get("avatar_url") if isinstance(owner, dict) else None
            if not isinstance(created_at, str) or not created_at:
                raise ValueError("GitHub metadata omitted created_at")
            if not isinstance(avatar_url, str) or not avatar_url:
                raise ValueError("GitHub metadata omitted owner.avatar_url")
            return {
                "star_count": count,
                "created_at": created_at,
                "avatar_url": avatar_url,
            }
        except (OSError, ValueError, json.JSONDecodeError, urllib.error.URLError) as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(attempt * 2)
    raise RuntimeError("GitHub repository metadata request failed: {0}".format(last_error))


def download_avatar_data_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != "avatars.githubusercontent.com":
        raise ValueError("GitHub metadata returned an unexpected avatar URL")
    request = urllib.request.Request(
        url + ("&" if parsed.query else "?") + "size=22",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        content_type = response.headers.get_content_type()
        body = response.read(2_000_001)
    if not content_type.startswith("image/") or len(body) > 2_000_000:
        raise ValueError("GitHub avatar response is not a supported image")
    return "data:{0};base64,{1}".format(
        content_type,
        base64.b64encode(body).decode("ascii"),
    )


def update_current_record(
    payload: Dict[str, Any],
    *,
    repository: str,
    star_count: int,
    current_time: datetime,
) -> Tuple[Dict[str, Any], bool]:
    updated = copy.deepcopy(payload)
    _validate_runtime_series(updated, repository)
    current = current_time.astimezone(timezone.utc)
    record = {"date": format_record_date(current), "count": star_count}
    records = updated["star_records"]
    latest = parse_record_date(records[-1]["date"])
    if current < latest:
        raise ValueError("current time predates the latest Star History record")
    if latest.date() == current.date():
        if records[-1]["count"] == star_count:
            return updated, False
        records[-1] = record
    else:
        records.append(record)
    _validate_runtime_series(updated, repository)
    return updated, True


def migrate_legacy_seed(
    payload: Dict[str, Any],
    *,
    repositories: Tuple[str, ...],
    metadata: Dict[str, Dict[str, Any]],
    current_time: datetime,
) -> Dict[str, Any]:
    validate_legacy_seed(payload, repositories)
    avatar_cache: Dict[str, str] = {}
    runtime_series: List[Dict[str, Any]] = []
    for index, repository in enumerate(repositories):
        legacy = payload["series"][index]
        records_by_time: Dict[datetime, int] = {}
        for point in legacy["reconstruction"]["daily"]:
            point_day = datetime.fromisoformat(point["date"]).date()
            end_of_day = datetime(
                point_day.year,
                point_day.month,
                point_day.day,
                tzinfo=timezone.utc,
            ) + timedelta(days=1)
            records_by_time[end_of_day] = point["stars"]
        for snapshot in legacy["snapshots"]:
            at = datetime.fromisoformat(snapshot["at"].replace("Z", "+00:00"))
            records_by_time[at.astimezone(timezone.utc)] = snapshot["stars"]
        records = [
            {"date": format_record_date(at), "count": records_by_time[at]}
            for at in sorted(records_by_time)
        ]
        avatar_url = metadata[repository]["avatar_url"]
        if avatar_url not in avatar_cache:
            avatar_cache[avatar_url] = download_avatar_data_url(avatar_url)
        series = {
            "repository": repository,
            "logo_url": avatar_cache[avatar_url],
            "star_records": records,
        }
        series, _ = update_current_record(
            series,
            repository=repository,
            star_count=metadata[repository]["star_count"],
            current_time=current_time,
        )
        runtime_series.append(series)
    migrated = {
        "format": DATA_FORMAT,
        "schema_version": SCHEMA_VERSION,
        "updated_at": current_time.isoformat().replace("+00:00", "Z"),
        "series": runtime_series,
    }
    return validate_data(migrated, repositories)


def atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        prefix=path.name + ".",
        suffix=".tmp",
        dir=path.parent,
        delete=False,
    ) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    temporary_path.replace(path)
    path.chmod(0o644)


def refresh_data_command(args: argparse.Namespace) -> int:
    try:
        repositories = validate_repositories(args.repository)
    except ValueError as exc:
        print("[error] {0}".format(exc))
        return 1
    token = os.environ.get(args.token_env, "").strip()
    if not token:
        print("[error] GitHub token environment variable is empty")
        return 1
    try:
        payload, source = load_best_data(
            repositories=repositories,
            seed_file=args.seed_file,
            deployed_url=args.deployed_url,
        )
        metadata = {
            repository: fetch_repository_metadata(repository, token)
            for repository in repositories
        }
        current_time = datetime.now(timezone.utc)
        if payload.get("format") != DATA_FORMAT:
            updated = migrate_legacy_seed(
                payload,
                repositories=repositories,
                metadata=metadata,
                current_time=current_time,
            )
            source = "legacy repository seed"
        else:
            updated = copy.deepcopy(payload)
            changed = False
            for index, repository in enumerate(repositories):
                series, series_changed = update_current_record(
                    updated["series"][index],
                    repository=repository,
                    star_count=metadata[repository]["star_count"],
                    current_time=current_time,
                )
                updated["series"][index] = series
                changed = changed or series_changed
            if changed:
                updated["updated_at"] = current_time.isoformat().replace("+00:00", "Z")
            validate_data(updated, repositories)
        atomic_write_json(args.output, updated)
    except (
        KeyError,
        TypeError,
        OSError,
        RuntimeError,
        ValueError,
        json.JSONDecodeError,
    ) as exc:
        print("[error] Star History data refresh failed: {0}".format(exc))
        return 1
    for index, repository in enumerate(repositories):
        print(
            "[data] {0}: {1} stars from {2} ({3} records)".format(
                repository,
                metadata[repository]["star_count"],
                source,
                len(updated["series"][index]["star_records"]),
            )
        )
    return 0


# ---------------------------------------------------------------------------
# Guarded official-backend patch
# ---------------------------------------------------------------------------


def replace_exactly_once(
    path: Path,
    original: str,
    replacement: str,
    description: str,
) -> bool:
    """Replace one pinned-upstream fragment and reject silent source drift."""
    source = path.read_text(encoding="utf-8")
    original_count = source.count(original)
    replacement_count = source.count(replacement)

    if original_count == 0 and replacement_count == 1:
        return False
    if original_count != 1 or replacement_count != 0:
        raise RuntimeError(
            "unexpected upstream implementation for {0} in {1} "
            "(original={2}, patched={3})".format(
                description,
                path,
                original_count,
                replacement_count,
            )
        )

    path.write_text(source.replace(original, replacement), encoding="utf-8")
    return True


def patch_upstream(source_dir: Path) -> List[Path]:
    """Patch the pinned checkout and return the files changed in this call."""
    path = source_dir / MAIN_PATH
    if not path.is_file():
        raise RuntimeError("missing pinned upstream file: {0}".format(path))
    changed = replace_exactly_once(
        path,
        STARTUP_ORIGINAL,
        STARTUP_PATCHED,
        "local data cache seed",
    )
    return [MAIN_PATH] if changed else []


def patch_upstream_command(args: argparse.Namespace) -> int:
    try:
        changed = patch_upstream(args.source_dir)
    except (OSError, RuntimeError) as exc:
        print("[error] Star History upstream patch failed: {0}".format(exc))
        return 1

    if changed:
        for path in changed:
            print("[patched] {0}".format(path))
    else:
        print("[current] Star History upstream patch is already applied")
    return 0


# ---------------------------------------------------------------------------
# Official localhost SVG rendering and pair fallback
# ---------------------------------------------------------------------------


def validate_local_backend_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value.rstrip("/"))
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise ValueError("backend URL must point to a local HTTP server")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ValueError("backend URL must be an origin without a path or query")
    return value.rstrip("/")


def validate_fallback_base_url(value: str) -> str:
    normalized = value.rstrip("/")
    parsed = urllib.parse.urlsplit(normalized)
    is_local_http = parsed.scheme == "http" and parsed.hostname in {
        "127.0.0.1",
        "localhost",
    }
    if parsed.scheme != "https" and not is_local_http:
        raise ValueError("fallback URL must use HTTPS or local HTTP")
    if not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("fallback URL must contain a host without credentials")
    if parsed.query or parsed.fragment:
        raise ValueError("fallback URL must not contain a query or fragment")
    return normalized


def chart_url(
    backend_url: str, repositories: Tuple[str, ...], theme: str
) -> str:
    params = {
        "repos": ",".join(repositories),
        "type": "date",
        "legend": "top-left",
    }
    if theme == "dark":
        params["theme"] = "dark"
    return "{0}/svg?{1}".format(backend_url, urllib.parse.urlencode(params))


def fallback_chart_url(base_url: str, theme: str) -> str:
    return "{0}/star-history-{1}.svg".format(base_url, theme)


def emit_github_warning(message: str) -> None:
    """Surface a degraded refresh as an Actions annotation."""
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return
    single_line = message.replace("\r", " ").replace("\n", " ")
    print("::warning title=Star History::{0}".format(single_line))


def download_svg(url: str, attempts: int = 4) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "image/svg+xml",
            "User-Agent": "deploy-star-history-pages local renderer",
        },
    )
    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                content_type = response.headers.get("Content-Type", "").lower()
                body = response.read(MAX_SVG_BYTES + 1)
            if "svg" not in content_type:
                raise ValueError(
                    "unexpected Content-Type: {0}".format(
                        content_type or "(missing)"
                    )
                )
            if len(body) > MAX_SVG_BYTES:
                raise ValueError("SVG response is unexpectedly large")
            return body
        except urllib.error.HTTPError as exc:
            try:
                response_body = exc.read().decode("utf-8", errors="replace").strip()
            finally:
                exc.close()
            detail = "HTTP {0} {1}".format(exc.code, exc.reason)
            if response_body:
                detail += ": {0}".format(response_body)
            last_error = RuntimeError(detail)
            if attempt == attempts:
                break
            time.sleep(attempt * 2)
        except (OSError, ValueError, urllib.error.URLError) as exc:
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(attempt * 2)
    raise RuntimeError("local Star History backend request failed: {0}".format(last_error))


def validate_svg(
    content: bytes, repositories: Tuple[str, ...], theme: str
) -> None:
    if len(content) < 10_000:
        raise ValueError("SVG is unexpectedly small: {0} bytes".format(len(content)))
    root = ET.fromstring(content)
    if root.tag.rsplit("}", 1)[-1] != "svg":
        raise ValueError("document root is not SVG: {0}".format(root.tag))
    if root.attrib.get("width") != "800" or root.attrib.get("height") != "533.333":
        raise ValueError(
            "official laptop chart dimensions changed: {0}x{1}".format(
                root.attrib.get("width"),
                root.attrib.get("height"),
            )
        )

    text = content.decode("utf-8")
    required_fragments = (
        "Star History",
        "GitHub Stars",
        "xkcdify",
        "font-family:xkcd",
    )
    required_fragments += repositories
    missing = [fragment for fragment in required_fragments if fragment not in text]
    if missing:
        raise ValueError(
            "SVG is missing official chart markers: {0}".format(", ".join(missing))
        )

    expected_background = "background:#0d1117" if theme == "dark" else "background:#fff"
    if expected_background not in text:
        raise ValueError("SVG does not contain the expected {0} theme".format(theme))


def atomic_write_svg(destination: Path, content: bytes) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="wb",
        prefix=destination.name + ".",
        suffix=".tmp",
        dir=destination.parent,
        delete=False,
    ) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)
    destination.chmod(0o644)
    print("[rendered] {0} ({1} bytes)".format(destination, len(content)))


def fetch_chart_pair(
    *,
    repositories: Tuple[str, ...],
    url_for_theme,
    attempts: int,
) -> Dict[str, bytes]:
    charts = {}
    for theme in THEMES:
        content = download_svg(url_for_theme(theme), attempts=attempts)
        validate_svg(content, repositories, theme)
        charts[theme] = content
    return charts


def render_command(args: argparse.Namespace) -> int:
    try:
        backend_url = validate_local_backend_url(args.backend_url)
        repositories = validate_repositories(args.repository)

        try:
            charts = fetch_chart_pair(
                repositories=repositories,
                url_for_theme=lambda theme: chart_url(
                    backend_url,
                    repositories,
                    theme,
                ),
                attempts=LOCAL_RENDER_ATTEMPTS,
            )
        except (RuntimeError, OSError, ValueError, ET.ParseError) as local_error:
            if not args.fallback_base_url:
                raise
            fallback_base_url = validate_fallback_base_url(args.fallback_base_url)
            warning = (
                "Local Star History refresh failed; reusing the last deployed "
                "chart pair: {0}".format(local_error)
            )
            print("[warning] {0}".format(warning), file=sys.stderr)
            emit_github_warning(warning)
            charts = fetch_chart_pair(
                repositories=repositories,
                url_for_theme=lambda theme: fallback_chart_url(
                    fallback_base_url,
                    theme,
                ),
                attempts=FALLBACK_RENDER_ATTEMPTS,
            )

        # Write only after both themes validate, preventing a mixed fresh/stale pair.
        for theme in THEMES:
            atomic_write_svg(
                args.output_dir / "star-history-{0}.svg".format(theme),
                charts[theme],
            )
    except (RuntimeError, OSError, ValueError, ET.ParseError) as exc:
        print("[error] Star History rendering failed: {0}".format(exc), file=sys.stderr)
        return 1
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "refresh-data":
        return refresh_data_command(args)
    if args.command == "patch-upstream":
        return patch_upstream_command(args)
    if args.command == "render":
        return render_command(args)
    raise RuntimeError("unknown Star History command: {0}".format(args.command))


if __name__ == "__main__":
    raise SystemExit(main())
