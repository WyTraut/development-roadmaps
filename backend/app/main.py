from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .calculator import PortfolioCalculator
from .models import PortfolioResponse, ScenarioRequest, ScenarioResult
from .store import RoadmapDataError, RoadmapStore


ROOT = Path(__file__).resolve().parents[2]


def create_app(
    data_path: Path | None = None,
    frontend_dist: Path | None = None,
) -> FastAPI:
    resolved_data_path = data_path or Path(
        os.environ.get("ROADMAP_DATA", ROOT / "data" / "roadmaps.yaml")
    )
    resolved_frontend_dist = frontend_dist or Path(
        os.environ.get("FRONTEND_DIST", ROOT / "frontend" / "dist")
    )
    store = RoadmapStore(resolved_data_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        store.load_initial()
        yield

    application = FastAPI(
        title="Executive Roadmap Portfolio API",
        version="1.0.0",
        lifespan=lifespan,
    )
    application.state.roadmap_store = store

    @application.get("/healthz")
    def health() -> dict[str, str]:
        try:
            store.snapshot()
        except RoadmapDataError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return {"status": "ok"}

    @application.get("/api/portfolio", response_model=PortfolioResponse)
    def portfolio() -> PortfolioResponse:
        config, data_status = store.snapshot()
        return PortfolioResponse(config=config, data_status=data_status)

    @application.post("/api/scenario", response_model=ScenarioResult)
    def scenario(request: ScenarioRequest) -> ScenarioResult:
        config, data_status = store.snapshot()
        try:
            return PortfolioCalculator(config).calculate(request, data_status)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    assets_dir = resolved_frontend_dist / "assets"
    if assets_dir.exists():
        application.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @application.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/") or path == "healthz":
            raise HTTPException(status_code=404, detail="Not found")
        index_path = resolved_frontend_dist / "index.html"
        requested_path = resolved_frontend_dist / path
        if path and requested_path.is_file():
            return FileResponse(requested_path)
        if index_path.is_file():
            return FileResponse(index_path)
        raise HTTPException(status_code=503, detail="Frontend build is not available")

    return application


app = create_app()
