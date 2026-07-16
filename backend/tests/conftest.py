from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from backend.app.models import DataStatus, PortfolioConfig


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "roadmaps.yaml"


@pytest.fixture
def config() -> PortfolioConfig:
    return PortfolioConfig.model_validate(yaml.safe_load(DATA_PATH.read_text(encoding="utf-8")))


@pytest.fixture
def data_status() -> DataStatus:
    return DataStatus(stale=False, warning=None, loaded_at="2026-07-13T12:00:00+00:00")
