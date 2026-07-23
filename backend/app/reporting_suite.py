from __future__ import annotations

import ast
import base64
import json
import re
import warnings
from collections import Counter
from collections.abc import Callable
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from .metrics import MetricsExportError
from .models import (
    ReportingSuiteSnapshot,
    ReportingSuiteSource,
    ReportingSuiteWorkspaceMetric,
)


RepositoryFileLoader = Callable[[ReportingSuiteSource, str, str | None], str]


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
    fallback_snapshot: ReportingSuiteSnapshot | None = None,
) -> ReportingSuiteSnapshot | None:
    if source is None:
        return None
    if source.requires_auth and not github_token:
        if fallback_snapshot is not None:
            _warn_fallback(source)
            return fallback_snapshot
        raise MetricsExportError(
            "METRICS_GITHUB_TOKEN is required to export private Reporting Suite "
            f"source '{source.id}'"
        )

    files: dict[str, str] = {}
    try:
        for path in (
            source.page_registry_path,
            source.server_path,
            source.database_path,
        ):
            files[path] = repository_file_loader(source, path, github_token)
    except MetricsExportError:
        if fallback_snapshot is not None:
            _warn_fallback(source)
            return fallback_snapshot
        raise
    except Exception as exc:
        if fallback_snapshot is not None:
            _warn_fallback(source)
            return fallback_snapshot
        raise MetricsExportError(
            f"Reporting Suite source '{source.id}' could not be loaded: {exc}"
        ) from exc

    return parse_reporting_suite_source(
        source,
        page_registry_text=files[source.page_registry_path],
        server_text=files[source.server_path],
        database_text=files[source.database_path],
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
    )


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
