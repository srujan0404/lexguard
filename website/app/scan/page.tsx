"use client";

import Link from "next/link";
import { useState } from "react";
import { Analyzer } from "@/components/analyzer";
import { AskFab } from "@/components/ask-fab";
import { ChatPanel } from "@/components/chat-panel";
import { Checklist } from "@/components/checklist";
import { ClauseCard } from "@/components/clause-card";
import { ScorecardHero } from "@/components/scorecard-hero";
import { ScrollReveal } from "@/components/scroll-reveal";
import { StatusPulse } from "@/components/status-pulse";
import { StatuteDrawer } from "@/components/statute-drawer";
import type { DocumentScorecard } from "@/lib/types";

export default function ScanPage() {
  const [scorecard, setScorecard] = useState<DocumentScorecard | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const [openStatute, setOpenStatute] = useState<string | null>(null);

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
        <section className="pt-16 md:pt-20">
          <p className="label mb-6">scan a document</p>
          <h1 className="display max-w-4xl text-[clamp(2rem,5vw,3.6rem)] text-ink leading-[1.05]">
            Paste it, upload it, or
            <br />
            give us a <span className="display-italic">URL</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-ink-mid leading-relaxed">
            About 50 seconds end-to-end. Five agents in parallel, grounded in
            Indian civil law. We never store the document text — only a hash for
            template detection.
          </p>
        </section>

        <ScrollReveal className="mt-14">
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
          <div id="results" className="mt-20 space-y-12">
            <ScrollReveal>
              <ScorecardHero scorecard={scorecard} />
            </ScrollReveal>

            <ScrollReveal>
              <ChatPanel
                documentId={scorecard.document_id}
                suggestedQuestions={scorecard.suggested_questions}
                language="en"
              />
            </ScrollReveal>

            <ScrollReveal>
              <Checklist items={scorecard.pre_sign_checklist} />
            </ScrollReveal>

            <ScrollReveal>
              <section>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="label">clause-by-clause</span>
                  <span className="h-px flex-1 bg-rule" />
                  <span className="label">
                    {scorecard.clauses.length} findings
                  </span>
                </div>
                <div>
                  {scorecard.clauses.map((c, i) => (
                    <ClauseCard
                      key={c.clause_id}
                      clause={c}
                      index={i}
                      onStatuteClick={setOpenStatute}
                    />
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

      <StatuteDrawer
        statuteId={openStatute}
        onClose={() => setOpenStatute(null)}
      />

      {scorecard && <AskFab targetId="chat-panel" />}
    </>
  );
}

function Header() {
  return (
    <header className="relative z-10 px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pt-8 flex items-center justify-between flex-wrap gap-y-3">
      <Link href="/" className="flex items-baseline gap-3">
        <span className="display-italic text-2xl">Lex</span>
        <span className="display text-2xl">Guard</span>
      </Link>
      <nav className="flex items-center gap-1 border border-rule rounded-full p-1">
        <NavPill href="/" label="Home" active={false} />
        <NavPill href="/scan" label="Scan" active />
        <NavPill href="/compare" label="Compare" active={false} />
      </nav>
      <StatusPulse label="Cloud Run / asia-south1" />
    </header>
  );
}

function NavPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative px-4 py-1.5 rounded-full transition-colors ${
        active ? "bg-surface" : ""
      }`}
    >
      <span
        className={`label ${
          active ? "text-ink" : "text-ink-low hover:text-ink-mid transition-colors"
        }`}
      >
        {label}
      </span>
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-px bg-accent" aria-hidden />
      )}
    </Link>
  );
}

function Footnote({ scorecard }: { scorecard: DocumentScorecard }) {
  return (
    <section className="border-t border-rule pt-8 flex flex-wrap items-baseline gap-x-8 gap-y-3 text-sm text-ink-low">
      <span className="label">processed</span>
      <span className="text-ink-mid">
        {(scorecard.processing_ms / 1000).toFixed(1)} s ·{" "}
        {scorecard.clauses.length} clauses · doc {scorecard.document_id}
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
        <a
          href="https://github.com/srujan0404/lexguard"
          target="_blank"
          rel="noreferrer"
          className="ml-auto label hover:text-accent transition-colors"
        >
          GitHub ↗
        </a>
      </div>
    </footer>
  );
}
