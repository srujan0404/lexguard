import { SeverityPill } from "./severity-pill";
import type { ClauseVerdict, DocumentScorecard, Severity } from "@/lib/types";

const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function CompareResult({
  a,
  b,
  labelA,
  labelB,
  onStatuteClick,
}: {
  a: DocumentScorecard;
  b: DocumentScorecard;
  labelA: string;
  labelB: string;
  onStatuteClick: (id: string) => void;
}) {
  const delta = a.risk_score - b.risk_score; // > 0 means A is riskier
  const winner = delta === 0 ? null : delta < 0 ? labelA : labelB;
  const loser = delta === 0 ? null : delta < 0 ? labelB : labelA;
  const diff = Math.abs(delta);

  return (
    <section className="space-y-16">
      <Verdict
        winner={winner}
        loser={loser}
        diff={diff}
        labelA={labelA}
        labelB={labelB}
        scoreA={a.risk_score}
        scoreB={b.risk_score}
      />

      <CountsRow a={a} b={b} labelA={labelA} labelB={labelB} />

      <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
        <DocColumn doc={a} label={labelA} onStatuteClick={onStatuteClick} />
        <DocColumn doc={b} label={labelB} onStatuteClick={onStatuteClick} />
      </div>
    </section>
  );
}

function Verdict({
  winner,
  loser,
  diff,
  labelA,
  labelB,
  scoreA,
  scoreB,
}: {
  winner: string | null;
  loser: string | null;
  diff: number;
  labelA: string;
  labelB: string;
  scoreA: number;
  scoreB: number;
}) {
  return (
    <header className="border-t border-rule pt-12">
      <span className="label mb-6 block">verdict</span>
      {winner && loser ? (
        <p className="display text-[clamp(1.8rem,4.4vw,3.4rem)] text-ink max-w-4xl leading-[1.05]">
          <span className="display-italic text-accent">{winner}</span> is{" "}
          {diff} points safer than{" "}
          <span className="display-italic">{loser}</span>.
        </p>
      ) : (
        <p className="display text-[clamp(1.8rem,4.4vw,3.4rem)] text-ink max-w-4xl">
          Both documents score identically. Read both clause-by-clause.
        </p>
      )}
      <div className="mt-10 grid grid-cols-2 gap-px bg-rule max-w-3xl">
        <ScoreBlock label={labelA} score={scoreA} />
        <ScoreBlock label={labelB} score={scoreB} />
      </div>
    </header>
  );
}

function ScoreBlock({ label, score }: { label: string; score: number }) {
  return (
    <div className="bg-bg px-6 py-6">
      <span className="label">{label}</span>
      <p className="display-italic text-6xl text-ink mt-2">{score}</p>
      <span className="label-wide">risk score / 100</span>
    </div>
  );
}

function CountsRow({
  a,
  b,
  labelA,
  labelB,
}: {
  a: DocumentScorecard;
  b: DocumentScorecard;
  labelA: string;
  labelB: string;
}) {
  const rows: Array<[Severity, string]> = [
    ["critical", "Critical"],
    ["high", "High"],
    ["medium", "Medium"],
    ["low", "Low"],
  ];
  return (
    <section className="border-t border-rule pt-8">
      <div className="flex items-baseline gap-3 mb-5">
        <span className="label">severity histogram</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-rule">
            <th className="label py-2">tier</th>
            <th className="label py-2 text-right">{labelA}</th>
            <th className="label py-2 text-right">{labelB}</th>
            <th className="label py-2 text-right">delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([sev, lbl]) => {
            const va = a.counts[sev];
            const vb = b.counts[sev];
            const d = va - vb;
            return (
              <tr key={sev} className="border-b border-rule">
                <td className="py-3">
                  <SeverityPill severity={sev} />{" "}
                  <span className="text-ink-mid ml-2">{lbl}</span>
                </td>
                <td className="py-3 text-right display text-xl text-ink">{va}</td>
                <td className="py-3 text-right display text-xl text-ink">{vb}</td>
                <td className="py-3 text-right">
                  <span
                    className={`label-wide ${
                      d === 0
                        ? "text-ink-low"
                        : d > 0
                          ? "text-accent"
                          : "text-ink"
                    }`}
                  >
                    {d > 0 ? `+${d}` : d}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function DocColumn({
  doc,
  label,
  onStatuteClick,
}: {
  doc: DocumentScorecard;
  label: string;
  onStatuteClick: (id: string) => void;
}) {
  const top = [...doc.clauses]
    .sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity])
    .slice(0, 6);
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-5">
        <span className="label">{label}</span>
        <span className="h-px flex-1 bg-rule" />
        <SeverityPill severity={doc.overall_severity} />
      </div>
      {doc.summary && (
        <p className="text-ink-mid leading-relaxed mb-6">{doc.summary}</p>
      )}
      <ul className="space-y-5">
        {top.map((c) => (
          <CompareClause
            key={c.clause_id}
            clause={c}
            onStatuteClick={onStatuteClick}
          />
        ))}
      </ul>
    </div>
  );
}

function CompareClause({
  clause,
  onStatuteClick,
}: {
  clause: ClauseVerdict;
  onStatuteClick: (id: string) => void;
}) {
  return (
    <li className="border-t border-rule pt-4">
      <div className="flex items-baseline gap-3 mb-2">
        <SeverityPill severity={clause.severity} />
        <h4 className="display text-lg text-ink truncate">{clause.title}</h4>
      </div>
      <p className="text-ink-mid text-sm leading-relaxed">
        {clause.plain_language}
      </p>
      {clause.statute_refs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {clause.statutes_cited.map((label, i) => {
            const id = clause.statute_refs[i];
            if (!id) return null;
            return (
              <button
                key={`${id}-${i}`}
                type="button"
                onClick={() => onStatuteClick(id)}
                className="text-ink-low text-xs underline decoration-rule decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent transition-colors"
              >
                § {label}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
