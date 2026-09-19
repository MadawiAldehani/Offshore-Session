/** Formatting helpers shared by the projector and the phones. */

/** 500000 → "500,000" */
export function formatNumber(value: number, thousands = true): string {
  const rounded = Math.round(value);
  return thousands ? rounded.toLocaleString("en-US") : String(rounded);
}

/** Value plus unit, with the spacing conventions people expect. */
export function formatValue(value: number, unit: string, thousands = true): string {
  const num = formatNumber(value, thousands);
  if (!unit) return num;
  // Currency reads better in front: "$500,000". Everything else trails: "2,900 m".
  if (unit.toUpperCase() === "USD") return `$${num}`;
  return `${num} ${unit}`;
}

/** Compact axis labels so a 1,000,000 range doesn't overflow the histogram. */
export function formatAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}k`;
  return trim(value);
}

function trim(n: number): string {
  // One decimal, but only when it adds information: 1.5k, not 2.0k.
  return Number(n.toFixed(1)).toString();
}

/** "1,200 m" for the depth readout. */
export function formatDepth(metres: number): string {
  return `${formatNumber(metres)} m`;
}

export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = n % 100;
  return n + (suffixes[(remainder - 20) % 10] ?? suffixes[remainder] ?? suffixes[0]);
}
