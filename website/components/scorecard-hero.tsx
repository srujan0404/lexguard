import type { DocumentScorecard } from "@/lib/types";
import { ListenButton } from "./listen-button";
import { SeverityPill } from "./severity-pill";

export function ScorecardHero({ scorecard }: { scorecard: DocumentScorecard }) {
  return (
    <section className="border-t border-rule pt-12">
      {scorecard.seen_before > 0 && (
        <div className="mb-10 border-l-2 border-accent pl-5 py-3">
          <p className="label text-accent mb-2">recycled template detected</p>
          <p className="text-ink leading-relaxed max-w-2xl">
            This exact document has appeared in{" "}
            <span className="text-accent">{scorecard.seen_before}</span> other{" "}
            {scorecard.seen_before === 1 ? "scan" : "scans"}
            {scorecard.issuer_name
              ? ` — issued by ${scorecard.issuer_name}.`
              : "."}{" "}
            It's a template, not personalised to you.
          </p>
        </div>
      )}
      <div className="grid gap-12 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="label">verdict / {scorecard.domain}</span>
            {scorecard.issuer_name && (
              <span className="label text-ink-mid">
                · {scorecard.issuer_name}
              </span>
            )}
            <span className="h-px flex-1 bg-rule min-w-6" />
            <ListenButton documentId={scorecard.document_id} />
            <SeverityPill severity={scorecard.overall_severity} />
          </div>

          <p className="display max-w-2xl text-[clamp(2rem,4.5vw,3.6rem)] text-ink">
            {scorecard.summary}
          </p>

          {scorecard.top_concerns.length > 0 && (
            <ul className="mt-10 grid gap-4 max-w-2xl">
              {scorecard.top_concerns.map((concern, i) => (
                <li key={i} className="flex gap-4 items-baseline">
                  <span className="label text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink-mid text-base leading-relaxed">
                    {concern}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <RiskScoreDial
          score={scorecard.risk_score}
          severity={scorecard.overall_severity}
        />
      </div>

      <Counts counts={scorecard.counts} />
    </section>
  );
}

function RiskScoreDial({
  score,
  severity,
}: {
  score: number;
  severity: DocumentScorecard["overall_severity"];
}) {
  const isCritical = severity === "critical";
  return (
    <div className="flex flex-col items-end gap-2">
      <span className="label">risk score / 100</span>
      <div className="relative">
        <span
          className={`display-italic block text-[clamp(7rem,16vw,12rem)] leading-none breath ${
            isCritical ? "text-accent" : "text-ink"
          }`}
        >
          {score}
        </span>
        <span className="absolute -right-1 top-2 label text-accent">●</span>
      </div>
    </div>
  );
}

function Counts({ counts }: { counts: DocumentScorecard["counts"] }) {
  const items: Array<[keyof typeof counts, string]> = [
    ["critical", "Critical"],
    ["high", "High"],
    ["medium", "Medium"],
    ["low", "Low"],
  ];
  return (
    <dl className="mt-14 grid grid-cols-4 gap-px bg-rule">
      {items.map(([key, label]) => (
        <div
          key={key}
          className="bg-bg px-5 py-5 flex flex-col gap-1"
        >
          <dt className="label">{label}</dt>
          <dd className="display text-3xl text-ink">{counts[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
