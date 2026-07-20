from __future__ import annotations

import json
import re
from collections.abc import Callable, Iterable
from datetime import date, datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .models import MetricsDailyTotal, MetricsEvidence, MetricsSnapshot, MetricsSource


class MetricsExportError(RuntimeError):
    """Raised when configured metrics evidence cannot be fetched or normalized."""


IssueBodyLoader = Callable[[MetricsSource, str | None], str]


def fetch_github_issue_body(source: MetricsSource, github_token: str | None) -> str:
    api_url = (
        f"https://api.github.com/repos/{source.repository}/issues/{source.issue_number}"
    )
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "development-roadmaps-metrics-export",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    try:
        with urlopen(Request(api_url, headers=headers), timeout=20) as response:  # noqa: S310
            payload = json.load(response)
    except HTTPError as exc:
        raise MetricsExportError(
            f"GitHub returned HTTP {exc.code} for metrics source '{source.id}'"
        ) from exc
    except URLError as exc:
        raise MetricsExportError(
            f"GitHub could not be reached for metrics source '{source.id}': {exc.reason}"
        ) from exc
    except (json.JSONDecodeError, OSError) as exc:
        raise MetricsExportError(
            f"GitHub returned an unreadable response for metrics source '{source.id}'"
        ) from exc

    body = payload.get("body") if isinstance(payload, dict) else None
    if not isinstance(body, str) or not body.strip():
        raise MetricsExportError(
            f"GitHub issue for metrics source '{source.id}' has no readable body"
        )
    return body


def parse_metrics_issue(source: MetricsSource, issue_body: str) -> MetricsSnapshot:
    sections = _markdown_sections(issue_body)
    summary = _summary_values(source, sections.get("All-User Summary", []))
    daily_totals = _daily_totals(source, sections.get("Daily Totals", []))
    privacy_note = " ".join(
        line.strip() for line in sections.get("Privacy Boundary", []) if line.strip()
    )
    if not privacy_note:
        raise MetricsExportError(
            f"Metrics source '{source.id}' is missing the Privacy Boundary section"
        )

    last_aggregated = _required_summary(source, summary, "last aggregated").strip("`")
    try:
        datetime.fromisoformat(last_aggregated.replace("Z", "+00:00"))
    except ValueError as exc:
        raise MetricsExportError(
            f"Metrics source '{source.id}' has an invalid Last aggregated value"
        ) from exc

    time_saved = _required_summary(source, summary, "estimated time saved")
    minutes_match = re.search(r"\(([0-9][0-9,]*)\s+minutes?\)", time_saved)
    if minutes_match:
        estimated_minutes_saved = _integer(minutes_match.group(1))
    else:
        hours_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s+hours?", time_saved)
        if not hours_match:
            raise MetricsExportError(
                f"Metrics source '{source.id}' has an invalid Estimated time saved value"
            )
        estimated_minutes_saved = round(float(hours_match.group(1)) * 60)

    return MetricsSnapshot(
        id=source.id,
        name=source.name,
        source_url=(
            f"https://github.com/{source.repository}/issues/{source.issue_number}"
        ),
        purpose=source.purpose,
        last_aggregated=last_aggregated,
        total_scrubs=_summary_integer(source, summary, "total scrubs"),
        warehouse_lookups=_summary_integer(
            source, summary, "warehouse/sre lookups"
        ),
        estimated_minutes_saved=estimated_minutes_saved,
        tracked_clients=_summary_integer(source, summary, "tracked clients"),
        daily_totals=daily_totals,
        privacy_note=privacy_note,
    )


def build_metrics_evidence(
    sources: Iterable[MetricsSource],
    github_token: str | None,
    issue_body_loader: IssueBodyLoader = fetch_github_issue_body,
) -> MetricsEvidence:
    snapshots: list[MetricsSnapshot] = []
    for source in sources:
        if source.requires_auth and not github_token:
            raise MetricsExportError(
                "METRICS_GITHUB_TOKEN is required to export private metrics "
                f"source '{source.id}'"
            )
        try:
            issue_body = issue_body_loader(source, github_token)
        except MetricsExportError:
            raise
        except Exception as exc:
            raise MetricsExportError(
                f"Metrics source '{source.id}' could not be loaded: {exc}"
            ) from exc
        snapshots.append(parse_metrics_issue(source, issue_body))
    return MetricsEvidence(sources=snapshots)


def _markdown_sections(body: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: list[str] | None = None
    for line in body.splitlines():
        heading = re.match(r"^##\s+(.+?)\s*$", line)
        if heading:
            current = sections.setdefault(heading.group(1), [])
        elif current is not None:
            current.append(line)
    return sections


def _summary_values(source: MetricsSource, lines: Iterable[str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in lines:
        item = re.match(r"^-\s+\*\*(.+?):\*\*\s*(.+?)\s*$", line.strip())
        if item:
            values[item.group(1).strip().lower()] = item.group(2).strip()
    if not values:
        raise MetricsExportError(
            f"Metrics source '{source.id}' is missing the All-User Summary section"
        )
    return values


def _required_summary(
    source: MetricsSource, values: dict[str, str], label: str
) -> str:
    try:
        return values[label]
    except KeyError as exc:
        raise MetricsExportError(
            f"Metrics source '{source.id}' is missing summary field '{label}'"
        ) from exc


def _summary_integer(
    source: MetricsSource, values: dict[str, str], label: str
) -> int:
    raw = _required_summary(source, values, label)
    match = re.search(r"[0-9][0-9,]*", raw)
    if not match:
        raise MetricsExportError(
            f"Metrics source '{source.id}' has an invalid '{label}' value"
        )
    return _integer(match.group(0))


def _integer(value: str) -> int:
    return int(value.replace(",", ""))


def _daily_totals(
    source: MetricsSource, lines: Iterable[str]
) -> list[MetricsDailyTotal]:
    totals: dict[str, int] = {}
    for line in lines:
        if not line.strip().startswith("|"):
            continue
        cells = [cell.strip().strip("`") for cell in line.strip().strip("|").split("|")]
        if len(cells) != 2 or cells[0].lower() == "date" or set(cells[0]) <= {"-", ":"}:
            continue
        try:
            parsed_date = date.fromisoformat(cells[0]).isoformat()
            scrubs = _integer(cells[1])
        except ValueError as exc:
            raise MetricsExportError(
                f"Metrics source '{source.id}' has an invalid Daily Totals row: {line}"
            ) from exc
        if parsed_date in totals:
            raise MetricsExportError(
                f"Metrics source '{source.id}' repeats Daily Totals date '{parsed_date}'"
            )
        totals[parsed_date] = scrubs

    if not totals:
        raise MetricsExportError(
            f"Metrics source '{source.id}' has no rows in the Daily Totals section"
        )
    return [
        MetricsDailyTotal(date=day, scrubs=scrubs)
        for day, scrubs in sorted(totals.items())
    ]
