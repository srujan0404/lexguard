"use client";

import { useState } from "react";
import { Analyzer } from "@/components/analyzer";
import { ScorecardHero } from "@/components/scorecard-hero";
import { ClauseCard } from "@/components/clause-card";
import { Checklist } from "@/components/checklist";
import { ScrollReveal } from "@/components/scroll-reveal";
import { StatusPulse } from "@/components/status-pulse";
import { API_BASE } from "@/lib/api";
import type { DocumentScorecard } from "@/lib/types";

export default function Page() {
  const [scorecard, setScorecard] = useState<DocumentScorecard | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );

  function handleResult(s: DocumentScorecard) {
    setError(null);
    setScorecard(s);
    requestAnimationFrame(() => {
      document
        .getElementById("results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleError(e: { message: string; requestId?: string }) {
    setScorecard(null);
    setError(e);
  }

  return (
    <>
      <Header />

      <main className="px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pb-32">
        <Hero />

        <ScrollReveal className="mt-20">
          <Analyzer onResult={handleResult} onError={handleError} />
        </ScrollReveal>

        {error && (
          <div
            role="alert"
            className="mt-10 border border-accent/40 bg-accent-soft px-5 py-4"
          >
            <p className="label text-accent mb-1">scan failed</p>
            <p className="text-ink-mid text-sm">{error.message}</p>
            {error.requestId && (
              <p className="text-ink-low text-xs mt-2 font-mono">
                request_id: {error.requestId}
              </p>
            )}
          </div>
        )}

        {scorecard && (
          <div id="results" className="mt-24 space-y-16">
            <ScrollReveal>
              <ScorecardHero scorecard={scorecard} />
            </ScrollReveal>

            <ScrollReveal>
              <Checklist items={scorecard.pre_sign_checklist} />
            </ScrollReveal>

            <ScrollReveal>
              <section>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="label">clause-by-clause</span>
                  <span className="h-px flex-1 bg-rule" />
                  <span className="label">{scorecard.clauses.length} findings</span>
                </div>
                <div>
                  {scorecard.clauses.map((c, i) => (
                    <ClauseCard key={c.clause_id} clause={c} index={i} />
                  ))}
                </div>
              </section>
            </ScrollReveal>

            <ScrollReveal>
              <Footnote scorecard={scorecard} />
            </ScrollReveal>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

function Header() {
  return (
    <header className="px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pt-8 flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <span className="display-italic text-2xl">Lex</span>
        <span className="display text-2xl">Guard</span>
      </div>
      <StatusPulse label="Cloud Run / asia-south1" />
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-20 md:pt-32">
      <p className="label mb-8">an adversarial AI consent firewall</p>

      <h1 className="display max-w-4xl text-[clamp(2.5rem,7vw,6rem)] text-ink">
        Read it{" "}
        <span className="display-italic">before</span>
        <br />
        you sign it.
      </h1>

      <p className="mt-10 max-w-2xl text-ink-mid text-lg leading-relaxed">
        Five AI agents read the contract, ground every flag in Indian civil law,
        argue from both sides, and hand back a structured scorecard. Built for
        the 40-page privacy policy nobody reads and the offer letter you're about
        to sign at 11&nbsp;pm.
      </p>

      <div className="mt-12 flex items-center gap-8 flex-wrap text-ink-low">
        <Stat label="agents" value="5" />
        <Stat label="risk categories" value="19" />
        <Stat label="indian statutes indexed" value="24" />
        <Stat label="not legal advice" value="∞" italic />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  italic,
}: {
  label: string;
  value: string;
  italic?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={`text-3xl text-ink ${
          italic ? "display-italic" : "display"
        }`}
      >
        {value}
      </span>
      <span className="label">{label}</span>
    </div>
  );
}

function Footnote({ scorecard }: { scorecard: DocumentScorecard }) {
  return (
    <section className="border-t border-rule pt-8 flex flex-wrap items-baseline gap-x-8 gap-y-3 text-sm text-ink-low">
      <span className="label">processed</span>
      <span className="text-ink-mid">
        {(scorecard.processing_ms / 1000).toFixed(1)} s · {scorecard.clauses.length}{" "}
        clauses · doc {scorecard.document_id}
      </span>
      <span className="ml-auto label">models</span>
      <span className="text-ink-mid font-mono text-xs">
        {Object.entries(scorecard.model_versions)
          .map(([k, v]) => `${k}=${v}`)
          .join("  ·  ")}
      </span>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pb-12">
      <div className="border-t border-rule pt-8 flex flex-wrap gap-y-3 gap-x-8 items-baseline">
        <span className="label">disclaimer</span>
        <p className="text-ink-mid text-sm max-w-2xl leading-relaxed">
          LexGuard is risk intelligence, not legal advice. It surfaces signals
          you can act on; it does not substitute for a lawyer when stakes are
          real.
        </p>
        <span className="label ml-auto">api</span>
        <a
          href={API_BASE}
          target="_blank"
          rel="noreferrer"
          className="text-ink-mid text-sm hover:text-accent transition-colors font-mono"
        >
          {API_BASE.replace(/^https?:\/\//, "")}
        </a>
      </div>
    </footer>
  );
}
