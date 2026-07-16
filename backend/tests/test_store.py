from __future__ import annotations

import time
from pathlib import Path

from backend.app.store import RoadmapStore


def test_invalid_edit_preserves_last_valid_snapshot(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[2] / "data" / "roadmaps.yaml"
    target = tmp_path / "roadmaps.yaml"
    target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    store = RoadmapStore(target)
    store.load_initial()
    original, original_status = store.snapshot()

    time.sleep(0.002)
    target.write_text("portfolio: [invalid", encoding="utf-8")
    stale, stale_status = store.snapshot()

    assert stale.portfolio.title == original.portfolio.title
    assert original_status.stale is False
    assert stale_status.stale is True
    assert "reload failed" in (stale_status.warning or "").lower()
