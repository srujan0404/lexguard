import type { Severity } from "@/lib/types";

const TONE: Record<Severity, { dot: string; text: string; ring: string }> = {
  low: {
    dot: "bg-ink-faint",
    text: "text-ink-low",
    ring: "ring-rule",
  },
  medium: {
    dot: "bg-ink-low",
    text: "text-ink-mid",
    ring: "ring-rule",
  },
  high: {
    dot: "bg-ink",
    text: "text-ink",
    ring: "ring-rule-strong",
  },
  critical: {
    dot: "bg-accent",
    text: "text-accent",
    ring: "ring-accent/40",
  },
};

export function SeverityPill({
  severity,
  className = "",
}: {
  severity: Severity;
  className?: string;
}) {
  const tone = TONE[severity];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 ring-1 ring-inset ${tone.ring} ${className}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      <span className={`label ${tone.text}`}>{severity}</span>
    </span>
  );
}
