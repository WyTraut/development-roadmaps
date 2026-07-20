import {
  BarChart3,
  Clock3,
  Database,
  ExternalLink,
  ScanText,
  ShieldCheck,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import type { CSSProperties } from "react";

import type { MetricsEvidence, MetricsSnapshot } from "./types";


const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

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

function formatDailyDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
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
  const maxScrubs = Math.max(1, ...snapshot.daily_totals.map((item) => item.scrubs));
  const chartWidth = Math.max(620, snapshot.daily_totals.length * 28);
  const warehouseMinutes = snapshot.minutes_saved_per_warehouse_query ?? 0;
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
            detail={
              warehouseMinutes > 0 ? `${warehouseMinutes} min saved each` : undefined
            }
          />
          <EvidenceMetric
            icon={UsersRound}
            label="Tracked clients"
            value={wholeNumber.format(snapshot.tracked_clients)}
          />
        </div>
      </section>

      <section className="metrics-trend-section" aria-labelledby={`metrics-trend-${snapshot.id}`}>
        <div className="metrics-trend-heading">
          <h2 id={`metrics-trend-${snapshot.id}`}>Daily scrubs</h2>
          <span>{snapshot.daily_totals.length} days</span>
        </div>

        {snapshot.daily_totals.length > 0 ? (
          <div className="metrics-chart-scroll">
            <div
              className="metrics-chart"
              role="img"
              aria-label={`Daily scrubs for ${snapshot.name}`}
              style={{ "--metrics-chart-width": `${chartWidth}px` } as CSSProperties}
            >
              {snapshot.daily_totals.map((item, index) => {
                const showDate =
                  index === 0 || index === snapshot.daily_totals.length - 1 || index % 5 === 0;
                const dailyLabel = `${formatDailyDate(item.date)}: ${wholeNumber.format(
                  item.scrubs
                )} ${item.scrubs === 1 ? "scrub" : "scrubs"}`;
                return (
                  <div className="metrics-chart-column" key={item.date} title={dailyLabel}>
                    <span className="metrics-chart-track" aria-hidden="true">
                      <span
                        className="metrics-chart-bar"
                        style={{ height: `${Math.max(4, (item.scrubs / maxScrubs) * 100)}%` }}
                      />
                    </span>
                    <time className={showDate ? undefined : "is-hidden"} dateTime={item.date}>
                      {formatDailyDate(item.date)}
                    </time>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="metrics-trend-empty">No daily activity.</p>
        )}
      </section>

      <footer
        className="metrics-privacy-note"
        aria-label={`Aggregate data only. ${snapshot.privacy_note}`}
        title={snapshot.privacy_note}
      >
        <ShieldCheck aria-hidden="true" size={22} />
        <strong>Aggregate data only</strong>
      </footer>
    </article>
  );
}

function EvidenceMetric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="metrics-summary-card">
      <span className="metrics-summary-icon" aria-hidden="true">
        <Icon size={19} />
      </span>
      <span className="metrics-summary-label">{label}</span>
      <strong>{value}</strong>
      {detail ? <span className="metrics-summary-detail">{detail}</span> : null}
    </div>
  );
}
