import {
  BarChart3,
  Clock3,
  Database,
  ExternalLink,
  RefreshCw,
  ScanText,
  ShieldCheck,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import type { CSSProperties } from "react";

import type { MetricsEvidence, MetricsSnapshot } from "./types";


const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatHours(minutes: number): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: minutes % 60 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  }).format(minutes / 60)} hours`;
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

function formatTimePart(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Latest source aggregation";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
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
    <section className="metrics-evidence" aria-labelledby="metrics-page-title">
      <header className="metrics-page-header">
        <div>
          <span className="section-kicker">Measured evidence</span>
          <h1 id="metrics-page-title">Metrics</h1>
          <p>Observed adoption and operational value from tools already in use.</p>
        </div>
        <span className="metrics-page-mark" aria-hidden="true">
          <BarChart3 size={28} strokeWidth={1.8} />
        </span>
      </header>

      {evidence.sources.length === 0 ? (
        <div className="metrics-empty-state" role="status">
          <BarChart3 aria-hidden="true" size={30} />
          <h2>No metrics snapshots available</h2>
          <p>Evidence will appear after a deployment exports a configured metrics source.</p>
        </div>
      ) : (
        evidence.sources.map((snapshot) => (
          <MetricsSourceSection key={snapshot.id} snapshot={snapshot} />
        ))
      )}
    </section>
  );
}

function MetricsSourceSection({ snapshot }: { snapshot: MetricsSnapshot }) {
  const maxScrubs = Math.max(1, ...snapshot.daily_totals.map((item) => item.scrubs));
  const chartWidth = Math.max(680, snapshot.daily_totals.length * 40);

  return (
    <article className="metrics-source-section" aria-labelledby={`metrics-source-${snapshot.id}`}>
      <header className="metrics-source-header">
        <div>
          <span className="section-kicker">Usage evidence</span>
          <h2 id={`metrics-source-${snapshot.id}`}>{snapshot.name}</h2>
          <p>{snapshot.purpose}</p>
        </div>
        <a className="metrics-source-link" href={snapshot.source_url} target="_blank" rel="noreferrer">
          View source issue
          <ExternalLink aria-hidden="true" size={17} />
        </a>
      </header>

      <div className="metrics-summary-grid" aria-label={`${snapshot.name} aggregate summary`}>
        <EvidenceMetric
          icon={ScanText}
          label="Total scrubs"
          value={wholeNumber.format(snapshot.total_scrubs)}
          detail="Completed scrub runs"
          tone="teal"
        />
        <EvidenceMetric
          icon={Database}
          label="Warehouse / SRE"
          value={wholeNumber.format(snapshot.warehouse_lookups)}
          detail="Reference lookups"
          tone="blue"
        />
        <EvidenceMetric
          icon={Clock3}
          label="Estimated time saved"
          value={formatHours(snapshot.estimated_minutes_saved)}
          detail={`${wholeNumber.format(snapshot.estimated_minutes_saved)} minutes`}
          tone="gold"
        />
        <EvidenceMetric
          icon={UsersRound}
          label="Tracked clients"
          value={wholeNumber.format(snapshot.tracked_clients)}
          detail="Aggregate contributors"
          tone="green"
        />
        <EvidenceMetric
          icon={RefreshCw}
          label="Last aggregated"
          value={formatDatePart(snapshot.last_aggregated)}
          detail={formatTimePart(snapshot.last_aggregated)}
          tone="neutral"
          compact
        />
      </div>

      <section className="metrics-trend-section" aria-labelledby={`metrics-trend-${snapshot.id}`}>
        <div className="metrics-trend-heading">
          <div>
            <h3 id={`metrics-trend-${snapshot.id}`}>Daily scrub activity</h3>
            <p>{snapshot.daily_totals.length} recorded days in this aggregate snapshot.</p>
          </div>
          <span className="metrics-trend-total">
            <strong>{wholeNumber.format(snapshot.total_scrubs)}</strong>
            total scrubs
          </span>
        </div>

        {snapshot.daily_totals.length > 0 ? (
          <div className="metrics-chart-scroll">
            <div
              className="metrics-chart"
              role="img"
              aria-label={`Daily scrub activity for ${snapshot.name}`}
              style={{ "--metrics-chart-width": `${chartWidth}px` } as CSSProperties}
            >
              {snapshot.daily_totals.map((item) => (
                <div className="metrics-chart-column" key={item.date}>
                  <span className="metrics-chart-value">{wholeNumber.format(item.scrubs)}</span>
                  <span className="metrics-chart-track" aria-hidden="true">
                    <span
                      className="metrics-chart-bar"
                      style={{ height: `${Math.max(4, (item.scrubs / maxScrubs) * 100)}%` }}
                    />
                  </span>
                  <time dateTime={item.date}>{formatDailyDate(item.date)}</time>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="metrics-trend-empty">Daily activity is not available for this snapshot.</p>
        )}
      </section>

      <footer className="metrics-privacy-note">
        <ShieldCheck aria-hidden="true" size={22} />
        <div>
          <strong>Aggregate only</strong>
          <p>{snapshot.privacy_note}</p>
        </div>
      </footer>
    </article>
  );
}

function EvidenceMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  compact = false
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "blue" | "gold" | "green" | "neutral";
  compact?: boolean;
}) {
  return (
    <div className={`metrics-summary-card tone-${tone}${compact ? " is-compact" : ""}`}>
      <span className="metrics-summary-icon" aria-hidden="true"><Icon size={19} /></span>
      <span className="metrics-summary-label">{label}</span>
      <strong>{value}</strong>
      <span className="metrics-summary-detail">{detail}</span>
    </div>
  );
}
