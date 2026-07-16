import type { NumericRange } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
});

const usdExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function readableNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatCurrencyRange(range?: NumericRange, exact = false): string {
  if (!range) return "--";
  const formatter = exact ? usdExact : usd;
  if (range.low === range.high) return formatter.format(range.low);
  return `${formatter.format(range.low)}-${formatter.format(range.high)}`;
}

export function formatNumberRange(range?: NumericRange, unit = ""): string {
  if (!range) return "--";
  const suffix = unit ? ` ${unit}` : "";
  if (range.low === range.high) return `${readableNumber(range.low)}${suffix}`;
  return `${readableNumber(range.low)}-${readableNumber(range.high)}${suffix}`;
}

export function sentenceCase(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
