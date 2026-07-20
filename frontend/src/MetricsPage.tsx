import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  Layers3,
  ScanText,
  Truck,
  UsersRound,
  type LucideIcon
} from "lucide-react";

import type { MetricsEvidence, MetricsSnapshot } from "./types";


const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const projectionOrderTarget = 800;
const projectionSteps = 8;
const aggregationSystems: Array<{ name: string; detail: string; icon: LucideIcon }> = [
  { name: "Slider", detail: "Scheduling", icon: CalendarDays },
  { name: "Warehouse", detail: "Orders", icon: Database },
  { name: "UPS", detail: "Tracking", icon: Truck },
  { name: "FortiGate", detail: "PDFs + configs", icon: FileText }
];

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

      <SystemAggregation sourceId={snapshot.id} />

      <ProjectedSavings
        minutes={snapshot.estimated_minutes_saved}
        orders={snapshot.total_scrubs}
        sourceId={snapshot.id}
      />
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

function SystemAggregation({ sourceId }: { sourceId: string }) {
  const headingId = `metrics-aggregation-${sourceId}`;

  return (
    <section className="metrics-aggregation-section" aria-labelledby={headingId}>
      <div className="metrics-aggregation-heading">
        <h2 id={headingId}>Four systems. One view.</h2>
      </div>
      <div
        className="metrics-aggregation-graphic"
        role="img"
        aria-label="Slider, Warehouse, UPS, and FortiGate aggregate into L2L Scrubber"
      >
        <div className="metrics-system-grid">
          {aggregationSystems.map(({ name, detail, icon: Icon }) => (
            <div className="metrics-system-node" key={name}>
              <span className="metrics-system-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <span>
                <strong>{name}</strong>
                <small>{detail}</small>
              </span>
            </div>
          ))}
        </div>

        <span className="metrics-aggregation-connector" aria-hidden="true">
          <ArrowRight size={30} />
        </span>

        <div className="metrics-aggregation-target">
          <span className="metrics-aggregation-target-icon" aria-hidden="true">
            <Layers3 size={25} />
          </span>
          <strong>L2L Scrubber</strong>
          <span>Unified order view</span>
        </div>
      </div>
    </section>
  );
}

function ProjectedSavings({
  minutes,
  orders,
  sourceId
}: {
  minutes: number;
  orders: number;
  sourceId: string;
}) {
  const projectedMinutes = orders > 0
    ? (Math.max(0, minutes) / orders) * projectionOrderTarget
    : 0;
  const headingId = `metrics-projection-${sourceId}`;
  const projectedTime = formatHours(projectedMinutes);

  return (
    <section className="metrics-projection-section" aria-labelledby={headingId}>
      <div className="metrics-projection-heading">
        <h2 id={headingId}>Projected time saved</h2>
      </div>
      <div
        className="metrics-projection-graphic"
        role="img"
        aria-label={`Projected time saved at ${wholeNumber.format(projectionOrderTarget)} orders: ${projectedTime}`}
      >
        <div className="metrics-projection-value">
          <strong>{projectedTime}</strong>
          <span>saved</span>
        </div>
        <div className="metrics-projection-plot" aria-hidden="true">
          <div className="metrics-projection-bars">
            {Array.from({ length: projectionSteps }, (_, index) => (
              <span
                key={index}
                style={{ height: `${((index + 1) / projectionSteps) * 100}%` }}
              />
            ))}
          </div>
          <div className="metrics-projection-axis">
            <span>100</span>
            <span>400</span>
            <span>800 orders</span>
          </div>
        </div>
      </div>
    </section>
  );
}
