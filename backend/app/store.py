from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from threading import RLock

import yaml
from pydantic import ValidationError

from .models import DataStatus, PortfolioConfig


class RoadmapDataError(RuntimeError):
    """Raised when roadmap configuration cannot be loaded or validated."""


class RoadmapStore:
    def __init__(self, path: Path):
        self.path = path
        self._lock = RLock()
        self._config: PortfolioConfig | None = None
        self._mtime_ns: int | None = None
        self._warning: str | None = None
        self._loaded_at: str | None = None

    def load_initial(self) -> None:
        with self._lock:
            self._load(allow_stale=False)

    def snapshot(self) -> tuple[PortfolioConfig, DataStatus]:
        with self._lock:
            current_mtime = self._current_mtime()
            if self._config is None:
                self._load(allow_stale=False)
            elif current_mtime != self._mtime_ns:
                self._load(allow_stale=True)

            assert self._config is not None
            assert self._loaded_at is not None
            return self._config, DataStatus(
                stale=self._warning is not None,
                warning=self._warning,
                loaded_at=self._loaded_at,
            )

    def _current_mtime(self) -> int:
        try:
            return self.path.stat().st_mtime_ns
        except OSError as exc:
            raise RoadmapDataError(f"cannot read roadmap data at {self.path}: {exc}") from exc

    def _load(self, allow_stale: bool) -> None:
        try:
            raw = yaml.safe_load(self.path.read_text(encoding="utf-8"))
            if raw is None:
                raise RoadmapDataError("roadmap data file is empty")
            config = PortfolioConfig.model_validate(raw)
            mtime = self._current_mtime()
        except (OSError, yaml.YAMLError, ValidationError, RoadmapDataError) as exc:
            message = self._format_error(exc)
            if allow_stale and self._config is not None:
                self._mtime_ns = self._current_mtime()
                self._warning = message
                return
            raise RoadmapDataError(message) from exc

        self._config = config
        self._mtime_ns = mtime
        self._warning = None
        self._loaded_at = datetime.now(timezone.utc).isoformat()

    def _format_error(self, exc: Exception) -> str:
        if isinstance(exc, ValidationError):
            details = "; ".join(
                f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                for error in exc.errors()
            )
            return f"Roadmap data validation failed: {details}"
        return f"Roadmap data reload failed: {exc}"
