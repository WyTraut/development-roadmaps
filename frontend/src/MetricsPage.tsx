import {
  BarChart3,
  Clock3,
  Database,
  ExternalLink,
  ScanText,
  UsersRound,
  type LucideIcon
} from "lucide-react";

import type { MetricsEvidence, MetricsSnapshot } from "./types";


const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const capacityNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const minutesPerWorkday = 8 * 60;
const workdaysPerWeek = 5;

function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return `${wholeNumber.format(hours)} ${hours === 1 ? "hour" : "hours"}`;
}

function formatDatePart(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export default function MetricsPage({ evidence }: { evidence: MetricsEvidence }) {
  return (
    <section className="metrics-evidence" aria-label="Operational impact metrics">
      {evidence.sources.length === 0 ? (
        <div className="metrics-empty-state" role="status">
          <BarChart3 aria-hidden="true" size={30} />
          <h1>Metrics</h1>
          <p>No metrics available.</p>
        </div>
      ) : (
        evidence.sources.map((snapshot, index) => (
          <MetricsSourceSection key={snapshot.id} snapshot={snapshot} primary={index === 0} />
        ))
      )}
    </section>
  );
}

function MetricsSourceSection({
  snapshot,
  primary
}: {
  snapshot: MetricsSnapshot;
  primary: boolean;
}) {
  const headingId = `metrics-source-${snapshot.id}`;
  const heading = `${snapshot.name} impact`;

  return (
    <article className="metrics-source-section" aria-labelledby={headingId}>
      <header className="metrics-source-header">
        <div>
          <span className="section-kicker">Usage to date</span>
          {primary ? <h1 id={headingId}>{heading}</h1> : <h2 id={headingId}>{heading}</h2>}
        </div>
        <div className="metrics-source-meta">
          <span>Updated {formatDatePart(snapshot.last_aggregated)}</span>
          <a
            className="metrics-source-link"
            href={snapshot.source_url}
            target="_blank"
            rel="noreferrer"
            aria-label={`View source metrics for ${snapshot.name}`}
            title="View source issue"
          >
            <ExternalLink aria-hidden="true" size={18} />
          </a>
        </div>
      </header>

      <section className="metrics-impact-summary" aria-label={`${snapshot.name} aggregate summary`}>
        <div className="metrics-impact-primary">
          <span className="metrics-impact-icon" aria-hidden="true">
            <Clock3 size={22} />
          </span>
          <span>Estimated time saved</span>
          <strong>{formatHours(snapshot.estimated_minutes_saved)}</strong>
        </div>
        <div className="metrics-summary-grid">
          <EvidenceMetric
            icon={ScanText}
            label="Scrubs"
            value={wholeNumber.format(snapshot.total_scrubs)}
          />
          <EvidenceMetric
            icon={Database}
            label="Warehouse queries"
            value={wholeNumber.format(snapshot.warehouse_lookups)}
          />
          <EvidenceMetric
            icon={UsersRound}
            label="Tracked clients"
            value={wholeNumber.format(snapshot.tracked_clients)}
          />
        </div>
      </section>

      <CapacityReturned minutes={snapshot.estimated_minutes_saved} sourceId={snapshot.id} />
    </article>
  );
}

function EvidenceMetric({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="metrics-summary-card">
      <span className="metrics-summary-icon" aria-hidden="true">
        <Icon size={19} />
      </span>
      <span className="metrics-summary-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CapacityReturned({ minutes, sourceId }: { minutes: number; sourceId: string }) {
  const totalWorkdays = Math.max(0, minutes) / minutesPerWorkday;
  let workweeks = Math.floor(totalWorkdays / workdaysPerWeek);
  let workdays = Math.round((totalWorkdays - workweeks * workdaysPerWeek) * 10) / 10;

  if (workdays >= workdaysPerWeek) {
    workweeks += 1;
    workdays = 0;
  }

  const showWorkweeks = workweeks > 0;
  const showWorkdays = workdays > 0 || !showWorkweeks;
  const dayTileCount = Math.max(1, Math.ceil(workdays));
  const accessibleUnits = [
    showWorkweeks ? formatCapacityUnit(workweeks, "workweek") : null,
    showWorkdays ? formatCapacityUnit(workdays, "day") : null
  ].filter(Boolean).join(" and ");
  const headingId = `metrics-capacity-${sourceId}`;

  return (
    <section className="metrics-capacity-section" aria-labelledby={headingId}>
      <div className="metrics-capacity-heading">
        <h2 id={headingId}>Capacity returned</h2>
        <span>8-hour days</span>
      </div>
      <div
        className="metrics-capacity-graphic"
        role="img"
        aria-label={`Equivalent capacity returned: ${accessibleUnits}`}
      >
        {showWorkweeks ? (
          <div className="metrics-capacity-unit">
            <span className="metrics-workweek-mark" aria-hidden="true">
              {Array.from({ length: workdaysPerWeek }, (_, index) => (
                <span key={index} />
              ))}
            </span>
            <strong>{formatCapacityUnit(workweeks, "workweek")}</strong>
          </div>
        ) : null}

        {showWorkweeks && showWorkdays ? (
          <span className="metrics-capacity-plus" aria-hidden="true">+</span>
        ) : null}

        {showWorkdays ? (
          <div className="metrics-capacity-unit">
            <span className="metrics-workday-mark" aria-hidden="true">
              {Array.from({ length: dayTileCount }, (_, index) => {
                const fill = Math.max(0, Math.min(1, workdays - index));
                return (
                  <span className="metrics-workday-tile" key={index}>
                    <span style={{ width: `${fill * 100}%` }} />
                  </span>
                );
              })}
            </span>
            <strong>{formatCapacityUnit(workdays, "day")}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatCapacityUnit(value: number, unit: "workweek" | "day"): string {
  const label = value === 1 ? unit : `${unit}s`;
  return `${capacityNumber.format(value)} ${label}`;
}
