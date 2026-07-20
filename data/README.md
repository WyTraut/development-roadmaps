# Editing Roadmap Data

The application reads `roadmaps.yaml` at startup and whenever the file changes. The Docker setup mounts this directory read-only into the application, so editing the YAML does not require rebuilding the image.

## Portfolio structure

- `portfolio` controls the page title, planning period, currency, and visible source note.
- `defaults` sets the opening stage for each roadmap and the opening delivery mode.
- `metrics_sources` identifies aggregate evidence sources and their value assumptions, such as minutes saved per warehouse query, baked into the static site during deployment.
- `work_packages` contains the atomic cost, duration, staffing, effort, dependency, confidence, and risk estimates.
- `roadmaps` maps cumulative Foundation, Scale, and Full Vision stages to work-package IDs.
- `assumptions` appears in the Assumptions view and printed report.

## Ranges and costs

Every numeric range uses `low` and `high`. A work package's all-in investment is the sum of:

- `loaded_labor`
- `vendors`
- `software_cloud`
- `contingency`

Values are whole USD amounts. Duration is measured in calendar months, `team_fte` is concurrent staffing while that work package is active, and `person_months` is total delivery effort.

## Shared work and dependencies

Use one globally unique work-package ID everywhere a capability is reused. When two selected roadmaps reference that ID directly or through dependencies, the portfolio counts it once and reports the avoided duplicate estimate as shared-work savings.

Every dependency must reference an existing work-package ID. Cycles, missing IDs, duplicate IDs, invalid ranges, or missing roadmap defaults prevent an invalid file from replacing the last valid data snapshot.

## Updating content safely

1. Keep the three roadmap IDs stable if existing shared URLs should continue to work.
2. Add a new work package before referencing it from a stage.
3. Keep stage IDs ordered as `foundation`, `scale`, and `full`.
4. Update `portfolio.last_updated` after approved estimate or content changes.
5. Open the app and confirm the data warning banner is absent.

Private GitHub issue sources require `METRICS_GITHUB_TOKEN` during static export. The token is used only at build time and is never written to the generated site bundle.
