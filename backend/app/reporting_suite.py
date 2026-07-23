from __future__ import annotations

import ast
import base64
import json
import re
import warnings
from collections import Counter
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from .metrics import MetricsExportError, fetch_github_issue_body
from .models import (
    ReportingSuiteMetricsPayload,
    ReportingSuiteMetricsSource,
    ReportingSuiteSnapshot,
    ReportingSuiteSource,
    ReportingSuiteWorkspaceMetric,
)


RepositoryFileLoader = Callable[[ReportingSuiteSource, str, str | None], str]
ReportingIssueBodyLoader = Callable[
    [ReportingSuiteMetricsSource, str | None],
    str,
]
REPORTING_METRICS_MARKER = "<!-- reporting-suite-metrics:v1 -->"


def fetch_github_repository_file(
    source: ReportingSuiteSource,
    path: str,
    github_token: str | None,
) -> str:
    api_url = (
        f"https://api.github.com/repos/{source.repository}/contents/"
        f"{quote(path, safe='/')}?ref={quote(source.ref, safe='')}"
    )
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "development-roadmaps-code-metrics-export",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    try:
        with urlopen(Request(api_url, headers=headers), timeout=20) as response:  # noqa: S310
            payload = json.load(response)
    except HTTPError as exc:
        raise MetricsExportError(
            f"GitHub returned HTTP {exc.code} for Reporting Suite source "
            f"'{source.id}' file '{path}'"
        ) from exc
    except URLError as exc:
        raise MetricsExportError(
            f"GitHub could not be reached for Reporting Suite source "
            f"'{source.id}': {exc.reason}"
        ) from exc
    except (json.JSONDecodeError, OSError) as exc:
        raise MetricsExportError(
            f"GitHub returned an unreadable response for Reporting Suite "
            f"source '{source.id}' file '{path}'"
        ) from exc

    encoded = payload.get("content") if isinstance(payload, dict) else None
    if not isinstance(encoded, str):
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' file '{path}' has no readable content"
        )
    try:
        normalized = re.sub(r"\s+", "", encoded)
        return base64.b64decode(normalized, validate=True).decode("utf-8")
    except (ValueError, UnicodeDecodeError) as exc:
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' file '{path}' is not valid UTF-8"
        ) from exc


def build_reporting_suite_snapshot(
    source: ReportingSuiteSource | None,
    github_token: str | None,
    repository_file_loader: RepositoryFileLoader = fetch_github_repository_file,
    issue_body_loader: ReportingIssueBodyLoader = fetch_github_issue_body,
    fallback_snapshot: ReportingSuiteSnapshot | None = None,
) -> ReportingSuiteSnapshot | None:
    if source is None:
        return None

    code_snapshot: ReportingSuiteSnapshot
    if source.requires_auth and not github_token:
        if fallback_snapshot is not None:
            _warn_fallback(source)
            code_snapshot = fallback_snapshot
        else:
            raise MetricsExportError(
                "METRICS_GITHUB_TOKEN is required to export private Reporting Suite "
                f"source '{source.id}'"
            )
    else:
        files: dict[str, str] = {}
        try:
            for path in (
                source.page_registry_path,
                source.server_path,
                source.database_path,
            ):
                files[path] = repository_file_loader(source, path, github_token)
            code_snapshot = parse_reporting_suite_source(
                source,
                page_registry_text=files[source.page_registry_path],
                server_text=files[source.server_path],
                database_text=files[source.database_path],
            )
        except MetricsExportError:
            if fallback_snapshot is None:
                raise
            _warn_fallback(source)
            code_snapshot = fallback_snapshot
        except Exception as exc:
            if fallback_snapshot is None:
                raise MetricsExportError(
                    f"Reporting Suite source '{source.id}' could not be loaded: {exc}"
                ) from exc
            _warn_fallback(source)
            code_snapshot = fallback_snapshot

    if source.metrics_issue is None:
        return code_snapshot
    if source.metrics_issue.requires_auth and not github_token:
        raise MetricsExportError(
            "METRICS_GITHUB_TOKEN is required to export Reporting Suite metrics "
            f"source '{source.metrics_issue.id}'"
        )
    try:
        issue_token = github_token if source.metrics_issue.requires_auth else None
        issue_body = issue_body_loader(source.metrics_issue, issue_token)
    except MetricsExportError:
        raise
    except Exception as exc:
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.metrics_issue.id}' "
            f"could not be loaded: {exc}"
        ) from exc
    return parse_reporting_suite_metrics_issue(
        source.metrics_issue,
        issue_body,
        code_snapshot,
    )


def load_reporting_suite_snapshot(path: Path) -> ReportingSuiteSnapshot:
    try:
        return ReportingSuiteSnapshot.model_validate_json(
            path.read_text(encoding="utf-8")
        )
    except (OSError, ValueError) as exc:
        raise MetricsExportError(
            f"Reporting Suite fallback snapshot '{path}' could not be loaded"
        ) from exc


def parse_reporting_suite_source(
    source: ReportingSuiteSource,
    *,
    page_registry_text: str,
    server_text: str,
    database_text: str,
) -> ReportingSuiteSnapshot:
    try:
        registry = json.loads(page_registry_text)
    except json.JSONDecodeError as exc:
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' has an invalid page registry"
        ) from exc
    pages = registry.get("pages") if isinstance(registry, dict) else None
    if not isinstance(pages, list):
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' page registry has no pages list"
        )

    active_pages = [
        page
        for page in pages
        if isinstance(page, dict) and page.get("status") == "active"
    ]
    workspace_counts = Counter(
        str(page.get("section") or "Other") for page in active_pages
    )
    active_page_ids = {
        str(page.get("id") or "")
        for page in active_pages
    }
    named_view_ids: set[str] = set()
    embedded_views = 0
    for page in active_pages:
        views = page.get("views") or []
        if not isinstance(views, list):
            raise MetricsExportError(
                f"Reporting Suite source '{source.id}' page views are invalid"
            )
        for view in views:
            _validate_named_view(source, view, named_view_ids)
            embedded_views += 1

    metric_view_groups = registry.get("metric_view_groups") or []
    if not isinstance(metric_view_groups, list):
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' metric view groups are invalid"
        )
    metric_views = 0
    for group in metric_view_groups:
        if not isinstance(group, dict):
            raise MetricsExportError(
                f"Reporting Suite source '{source.id}' has an invalid metric view group"
            )
        if str(group.get("parent_page") or "") not in active_page_ids:
            raise MetricsExportError(
                f"Reporting Suite source '{source.id}' metric view group "
                "does not reference an active page"
            )
        views = group.get("views")
        if not isinstance(views, list) or not views:
            raise MetricsExportError(
                f"Reporting Suite source '{source.id}' has an empty metric view group"
            )
        for view in views:
            _validate_named_view(source, view, named_view_ids)
            metric_views += 1

    source_system_rows = registry.get("source_systems") or []
    if not isinstance(source_system_rows, list):
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' source systems are invalid"
        )
    source_systems: list[str] = []
    for row in source_system_rows:
        name = str(row.get("name") or "").strip() if isinstance(row, dict) else ""
        if not name or name in source_systems:
            raise MetricsExportError(
                f"Reporting Suite source '{source.id}' has an invalid source system"
            )
        source_systems.append(name)

    try:
        server_tree = ast.parse(server_text)
    except SyntaxError as exc:
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' has invalid server source"
        ) from exc

    api_routes = {
        value.split("?", 1)[0].rstrip("/")
        for node in ast.walk(server_tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and (value := node.value.strip()).startswith("/api/")
        and not any(character.isspace() for character in value)
    }
    scheduled_workflows, automation_steps = _schedule_counts(server_tree)
    data_tables = set(
        re.findall(
            r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"
            r"([A-Za-z_][A-Za-z0-9_]*)",
            database_text,
            flags=re.IGNORECASE,
        )
    )

    return ReportingSuiteSnapshot(
        id=source.id,
        name=source.name,
        source_url=f"https://github.com/{source.repository}/tree/{source.ref}",
        source_ref=source.ref,
        purpose=source.purpose,
        registered_views=len(pages),
        active_views=len(active_pages),
        api_capabilities=len(api_routes),
        data_tables=len(data_tables),
        automation_steps=automation_steps,
        scheduled_workflows=scheduled_workflows,
        workspaces=[
            ReportingSuiteWorkspaceMetric(name=name, active_views=count)
            for name, count in sorted(
                workspace_counts.items(),
                key=lambda item: (-item[1], item[0]),
            )
        ],
        source_note=(
            "Derived from the active page registry, API route definitions, "
            "database schema, and scheduler configuration."
        ),
        report_views=len(active_pages) + embedded_views + metric_views,
        source_systems=source_systems,
    )


def parse_reporting_suite_metrics_issue(
    source: ReportingSuiteMetricsSource,
    issue_body: str,
    code_snapshot: ReportingSuiteSnapshot,
) -> ReportingSuiteSnapshot:
    if REPORTING_METRICS_MARKER not in issue_body:
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.id}' is missing marker "
            f"'{REPORTING_METRICS_MARKER}'"
        )
    match = re.search(
        r"```json\s*(\{.*?\})\s*```",
        issue_body,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if match is None:
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.id}' has no JSON payload"
        )
    try:
        raw_payload = json.loads(match.group(1))
        payload = ReportingSuiteMetricsPayload.model_validate(raw_payload)
    except (json.JSONDecodeError, ValueError) as exc:
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.id}' has an invalid v1 payload"
        ) from exc

    _validate_issue_timestamp(source, "tracking_started", payload.tracking_started)
    _validate_issue_timestamp(source, "last_aggregated", payload.last_aggregated)
    live_totals = (payload.total_views, payload.data_points, payload.unique_viewers)
    if any(value is None for value in live_totals) and not all(
        value is None for value in live_totals
    ):
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.id}' has incomplete live totals"
        )
    if any(value is not None for value in live_totals) and payload.last_aggregated is None:
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.id}' has live totals "
            "without last_aggregated"
        )
    months = [row.month for row in payload.monthly_views]
    if months != sorted(set(months)):
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.id}' has duplicate or "
            "unordered monthly views"
        )
    if payload.monthly_views and payload.total_views is None:
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.id}' has monthly views "
            "without total_views"
        )

    merged = code_snapshot.model_dump()
    merged.update({
        "source_url": (
            f"https://github.com/{source.repository}/issues/{source.issue_number}"
        ),
        "source_ref": payload.code_ref,
        "report_views": code_snapshot.report_views,
        "total_views": payload.total_views,
        "data_points": payload.data_points,
        "unique_viewers": payload.unique_viewers,
        "source_systems": code_snapshot.source_systems or payload.source_systems,
        "tracking_started": payload.tracking_started,
        "last_aggregated": payload.last_aggregated,
        "monthly_views": payload.monthly_views,
        "privacy_note": payload.privacy_note,
    })
    return ReportingSuiteSnapshot.model_validate(merged)


def _validate_named_view(
    source: ReportingSuiteSource,
    view: object,
    known_ids: set[str],
) -> None:
    if not isinstance(view, dict):
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' has an invalid named view"
        )
    view_id = str(view.get("id") or "").strip()
    title = str(view.get("title") or "").strip()
    if not view_id or not title or view_id in known_ids:
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' has a duplicate or incomplete "
            "named view"
        )
    known_ids.add(view_id)


def _validate_issue_timestamp(
    source: ReportingSuiteMetricsSource,
    label: str,
    value: str | None,
) -> None:
    if value is None:
        return
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise MetricsExportError(
            f"Reporting Suite metrics source '{source.id}' has an invalid {label}"
        ) from exc


def _schedule_counts(server_tree: ast.AST) -> tuple[int, int]:
    for node in ast.walk(server_tree):
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        if not any(
            isinstance(target, ast.Name) and target.id == "_SCHEDULE_V2"
            for target in targets
        ):
            continue
        if not isinstance(node.value, (ast.List, ast.Tuple)):
            return (0, 0)

        workflows = 0
        steps = 0
        for item in node.value.elts:
            if not isinstance(item, ast.Dict):
                continue
            workflows += 1
            for key, value in zip(item.keys, item.values, strict=True):
                if (
                    isinstance(key, ast.Constant)
                    and key.value == "steps"
                    and isinstance(value, (ast.List, ast.Tuple))
                ):
                    steps += len(value.elts)
        return workflows, steps
    return (0, 0)


def _warn_fallback(source: ReportingSuiteSource) -> None:
    warnings.warn(
        f"Reporting Suite source '{source.id}' is unavailable; using the "
        "checked-in code-derived snapshot.",
        RuntimeWarning,
        stacklevel=2,
    )
