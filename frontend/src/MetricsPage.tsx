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
const oneDecimalNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const projectionOrderTarget = 800;
const expansionProducts = [
  { id: "zero-touch", name: "Zero Touches", shortName: "Zero Touches", hours: 500 },
  { id: "sdwan", name: "SD-WAN new installs", shortName: "SD-WAN", hours: 1000 },
  { id: "fortigate", name: "FortiGate installs", shortName: "FortiGate", hours: 1000 },
  { id: "plug-and-play", name: "Plug and Play VPN installs", shortName: "P&P VPN", hours: 2000 }
];
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

function formatMonths(months: number): string {
  const rounded = Math.round(months * 10) / 10;
  return `${oneDecimalNumber.format(rounded)} ${rounded === 1 ? "month" : "months"}`;
}

function buildMonthlyMilestones(months: number): number[] {
  if (!Number.isFinite(months) || months <= 0) return [0];

  if (months <= 8) {
    const wholeMonths = Math.floor(months);
    const milestones = Array.from({ length: wholeMonths }, (_, index) => index + 1);
    if (months - wholeMonths >= 0.05 || milestones.length === 0) milestones.push(months);
    return milestones;
  }

  return Array.from({ length: 8 }, (_, index) => (months * (index + 1)) / 8);
}

function formatProductList(products: string[]): string {
  if (products.length <= 1) return products[0] ?? "";
  if (products.length === 2) return `${products[0]} and ${products[1]}`;
  return `${products.slice(0, -1).join(", ")}, and ${products[products.length - 1]}`;
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
      <p className="metrics-aggregation-caption">Sources aggregated through automation</p>
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
  const observedMinutes = Math.max(0, minutes);
  const projectedMinutes = orders > 0
    ? (observedMinutes / orders) * projectionOrderTarget
    : 0;
  const monthsToTarget = observedMinutes > 0 ? projectedMinutes / observedMinutes : 0;
  const monthlyMilestones = buildMonthlyMilestones(monthsToTarget);
  const axisMilestones = monthlyMilestones.length <= 2
    ? monthlyMilestones
    : [
        monthlyMilestones[0],
        monthlyMilestones[Math.floor(monthlyMilestones.length / 2)],
        monthlyMilestones[monthlyMilestones.length - 1]
      ];
  const currentHours = Math.round(projectedMinutes / 60);
  const productStages = [
    {
      id: "l2l",
      name: "L2L",
      shortName: "L2L",
      contribution: currentHours,
      current: true
    },
    ...expansionProducts.map((product) => ({
      ...product,
      contribution: product.hours,
      current: false
    }))
  ];
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [hoveredProductIndex, setHoveredProductIndex] = useState<number | null>(null);
  const activeProductIndex = hoveredProductIndex ?? selectedProductIndex;
  const includedProducts = productStages.slice(0, activeProductIndex + 1);
  const activeHours = includedProducts.reduce((total, product) => total + product.contribution, 0);
  const headingId = `metrics-projection-${sourceId}`;
  const projectedTime = `${wholeNumber.format(activeHours)} ${activeHours === 1 ? "hour" : "hours"}`;
  const projectionDuration = formatMonths(monthsToTarget);
  const includedProductNames = formatProductList(includedProducts.map((product) => product.name));

  return (
    <section className="metrics-projection-section" aria-labelledby={headingId}>
      <div className="metrics-projection-heading">
        <h2 id={headingId}>Projected time saved</h2>
      </div>
      <div className="metrics-projection-graphic">
        <div className="metrics-projection-value">
          <strong>{projectedTime}</strong>
          <span>in {projectionDuration}</span>
          <small>
            {activeProductIndex === 0
              ? "Current L2L automation"
              : `${activeProductIndex + 1} products automated`}
          </small>
        </div>
        <div className="metrics-projection-visual">
          <div
            className="metrics-projection-plot"
            role="img"
            aria-label={`Projected time saved: ${projectedTime} in ${projectionDuration} with ${includedProductNames} automation`}
          >
            <div
              className="metrics-projection-bars"
              style={{ gridTemplateColumns: `repeat(${monthlyMilestones.length}, minmax(18px, 1fr))` }}
              aria-hidden="true"
            >
              {monthlyMilestones.map((month) => (
                <span className="metrics-projection-bar-track" key={month}>
                  <span
                    className="metrics-projection-bar-stack"
                    style={{
                      height: `${monthsToTarget > 0 ? (month / monthsToTarget) * 100 : 0}%`
                    }}
                  >
                    {includedProducts.map((product) => (
                      <span
                        className={`metrics-projection-product-layer product-${product.id}`}
                        key={product.id}
                        style={{
                          height: `${activeHours > 0
                            ? (product.contribution / activeHours) * 100
                            : 0}%`
                        }}
                      />
                    ))}
                  </span>
                </span>
              ))}
            </div>
            <div
              className={`metrics-projection-axis${axisMilestones.length === 1 ? " single" : ""}`}
              aria-hidden="true"
            >
              {axisMilestones.map((month) => (
                <span key={month}>{formatMonths(month)}</span>
              ))}
            </div>
          </div>
          <div
            className="metrics-product-selector"
            role="group"
            aria-label="Product automation scenarios"
            onMouseLeave={() => setHoveredProductIndex(null)}
          >
            {productStages.map((product, index) => (
              <button
                className={`metrics-product-option product-${product.id}${
                  index <= activeProductIndex ? " included" : ""
                }${selectedProductIndex === index ? " selected" : ""}`}
                type="button"
                key={product.id}
                aria-label={`Include through ${product.name}`}
                aria-pressed={selectedProductIndex === index}
                title={`Include through ${product.name}`}
                onMouseEnter={() => setHoveredProductIndex(index)}
                onFocus={() => setHoveredProductIndex(index)}
                onBlur={() => setHoveredProductIndex(null)}
                onClick={() => setSelectedProductIndex(index)}
              >
                <strong>{product.shortName}</strong>
                <small>
                  {product.current
                    ? "Current"
                    : `+${wholeNumber.format(product.contribution)}h`}
                </small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
