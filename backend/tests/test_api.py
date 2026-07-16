from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app


ROOT = Path(__file__).resolve().parents[2]


def test_health_portfolio_and_scenario_endpoints(tmp_path: Path) -> None:
    app = create_app(ROOT / "data" / "roadmaps.yaml", tmp_path / "dist")
    with TestClient(app) as client:
        assert client.get("/healthz").json() == {"status": "ok"}

        portfolio = client.get("/api/portfolio")
        assert portfolio.status_code == 200
        config = portfolio.json()["config"]
        assert len(config["roadmaps"]) == 3

        scenario = client.post(
            "/api/scenario",
            json={
                "selections": config["defaults"]["selections"],
                "execution_mode": "parallel",
            },
        )
        assert scenario.status_code == 200
        assert scenario.json()["totals"]["investment"]["high"] < 1_000_000


def test_api_rejects_mismatched_roadmap_keys(tmp_path: Path) -> None:
    app = create_app(ROOT / "data" / "roadmaps.yaml", tmp_path / "dist")
    with TestClient(app) as client:
        response = client.post(
            "/api/scenario",
            json={
                "selections": {"network_automation": "foundation"},
                "execution_mode": "parallel",
            },
        )
        assert response.status_code == 422
        assert "selections must match roadmap IDs" in response.json()["detail"]
