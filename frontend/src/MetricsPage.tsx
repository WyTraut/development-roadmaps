import {
  AppWindow,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Cloud,
  Database,
  ExternalLink,
  FileText,
  Info,
  Layers3,
  Plane,
  ScanText,
  Share2,
  Truck,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { MetricsEvidence, MetricsSnapshot } from "./types";


const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const projectionOrderTarget = 800;
const projectionSteps = 8;
const aggregationSystems: Array<{ name: string; icon: LucideIcon }> = [
  { name: "Slider", icon: CalendarDays },
  { name: "Warehouse", icon: Database },
  { name: "UPS", icon: Truck },
  { name: "FortiGate", icon: FileText },
  { name: "SharePoint", icon: Share2 },
  { name: "Power Apps", icon: AppWindow },
  { name: "OneDrive", icon: Cloud },
  { name: "FlightDeck", icon: Plane }
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
  const scrubToolSource = snapshot.id === "l2l_scrubber";
  const heading = scrubToolSource ? snapshot.name : `${snapshot.name} impact`;

  return (
    <article className="metrics-source-section" aria-labelledby={headingId}>
      <header className="metrics-source-header">
        <div>
          {scrubToolSource ? null : <span className="section-kicker">Usage to date</span>}
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
            helpText="A process where network technicians gather information and verify logistical and network standards. It is crucial to preventing HEOs and failures while significantly reducing activation times."
          />
          <EvidenceMetric
            icon={Database}
            label="Warehouse queries"
            value={wholeNumber.format(snapshot.warehouse_lookups)}
            helpText="The number of times the tool checks Warehouse order records to confirm equipment, location, and activation details."
            helpAlign="right"
          />
          <EvidenceMetric
            icon={UsersRound}
            label="Tracked clients"
            value={wholeNumber.format(snapshot.tracked_clients)}
          />
        </div>
      </section>

      <SystemAggregation productName={snapshot.name} sourceId={snapshot.id} />

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
  value,
  helpText,
  helpAlign = "left"
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helpText?: string;
  helpAlign?: "left" | "right";
}) {
  return (
    <div className="metrics-summary-card">
      <span className="metrics-summary-icon" aria-hidden="true">
        <Icon size={19} />
      </span>
      <div className="metrics-summary-label-row">
        <span className="metrics-summary-label">{label}</span>
        {helpText ? <MetricInfo align={helpAlign} label={label} text={helpText} /> : null}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function MetricInfo({
  align,
  label,
  text
}: {
  align: "left" | "right";
  label: string;
  text: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const tooltipId = useId();
  const open = hovered || focused;

  return (
    <span
      className="metrics-info"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        className="metrics-info-button"
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setHovered(false);
            setFocused(false);
            event.currentTarget.blur();
          }
        }}
      >
        <Info aria-hidden="true" size={13} />
      </button>
      {open ? (
        <span
          className={`metrics-info-tooltip align-${align}`}
          id={tooltipId}
          role="tooltip"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

function SystemAggregation({
  productName,
  sourceId
}: {
  productName: string;
  sourceId: string;
}) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = `metrics-explanation-${sourceId}`;
  const copyId = `${headingId}-copy`;

  function closeExplanation() {
    setExplanationOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!explanationOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeExplanation();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [explanationOpen]);

  return (
    <section
      className="metrics-aggregation-section"
      aria-label={`Systems aggregated by ${productName}`}
    >
      <div
        className="metrics-aggregation-graphic"
        role="group"
        aria-label={`Slider, Warehouse, UPS, FortiGate, SharePoint, Power Apps, OneDrive, and FlightDeck aggregate into ${productName}`}
      >
        <div className="metrics-system-grid">
          {aggregationSystems.map(({ name, icon: Icon }) => (
            <div className="metrics-system-node" key={name}>
              <span className="metrics-system-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <strong>{name}</strong>
            </div>
          ))}
        </div>

        <span className="metrics-aggregation-connector" aria-hidden="true">
          <ArrowRight size={30} />
        </span>

        <button
          ref={triggerRef}
          className="metrics-aggregation-target"
          type="button"
          aria-label={`How ${productName} works`}
          title={`How ${productName} works`}
          onClick={() => setExplanationOpen(true)}
        >
          <span className="metrics-aggregation-target-icon" aria-hidden="true">
            <Layers3 aria-hidden="true" size={25} />
          </span>
          <strong>{productName}</strong>
        </button>
      </div>

      {explanationOpen ? (
        <div className="metrics-explanation-layer">
          <div
            className="metrics-explanation-backdrop"
            data-testid="metrics-explanation-backdrop"
            aria-hidden="true"
            onClick={closeExplanation}
          />
          <section
            className="metrics-explanation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={copyId}
          >
            <header className="metrics-explanation-header">
              <span className="metrics-explanation-header-icon" aria-hidden="true">
                <Layers3 size={21} />
              </span>
              <h2 id={headingId}>How {productName} works</h2>
              <button
                ref={closeRef}
                className="metrics-explanation-close"
                type="button"
                aria-label="Close explanation"
                title="Close"
                onClick={closeExplanation}
              >
                <X aria-hidden="true" size={20} />
              </button>
            </header>
            <div className="metrics-explanation-copy" id={copyId}>
              <p>
                {productName} starts with a task ID from Slider or FlightDeck. It uses that ID to
                open the matching invite and reads the order number, location, and scheduled date.
              </p>
              <p>
                It uses those details to find the matching sales intake PDF and supporting files
                in SharePoint and OneDrive. It checks the related Warehouse and Power Apps record,
                adds UPS delivery status when available, and finds the matching FortiGate files.
              </p>
              <p>
                The app compares the order ID, location, schedule, equipment, shipping, and device
                details across those sources. Matching information is brought together in one
                review package for a person to confirm.
              </p>
            </div>
          </section>
        </div>
      ) : null}
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
