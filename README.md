# Executive Roadmap Portfolio Configurator

A local, stateless planning application for comparing Network Automation, Reporting, and Audit Automation investments. FastAPI owns roadmap validation and calculations; React provides the executive comparison, delivery timeline, stage details, URL sharing, and print/PDF experience.

The repository also supports a serverless GitHub Pages build. Its deployment workflow validates `data/roadmaps.yaml`, precomputes every scenario with the same Python calculator, and publishes the React application with those results bundled as static data.

## Run the application

Docker is the supported local runtime:

```bash
docker compose up --build
```

Open either:

- `http://localhost:8080`
- `http://Wyatts-MacBook-Air.local:8080` from another device on the same trusted network

Stop the service with `Ctrl+C`, or run `docker compose down` from another terminal.

## Edit roadmap content

All product content and estimates live in `data/roadmaps.yaml`. The directory is mounted read-only into the container, and the running service detects file changes automatically. See `data/README.md` for the schema, validation rules, range conventions, and safe editing sequence.

Invalid startup data prevents the service from starting. If a file becomes invalid after startup, the application keeps the last valid snapshot and displays a warning until the YAML is corrected.

## API

- `GET /api/portfolio` returns the validated configuration and data status.
- `POST /api/scenario` calculates one stateless portfolio scenario.
- `GET /healthz` reports whether valid roadmap data is available.
- Interactive OpenAPI documentation is available at `/docs`.

Scenario links store only the three selected stage IDs and delivery mode in the URL. No scenarios, users, or browser data are stored by the server.

## Development checks

Backend tests:

```bash
.venv/bin/pytest -q
```

Frontend tests and production build:

```bash
cd frontend
pnpm run test
pnpm run build
```

## Build the static Pages version

Generate all 128 combinations of roadmap depth and delivery mode, then build with a repository base path:

```bash
.venv/bin/python backend/scripts/export_static.py
cd frontend
VITE_STATIC_SITE=true VITE_BASE_PATH=/development-roadmaps/ pnpm run build
```

The workflow in `.github/workflows/deploy-pages.yml` runs these steps automatically on pushes to `main`. The generated scenario bundle is intentionally excluded from Git because it is recreated from the validated YAML during every deployment.
