"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { Checklist } from "@/components/checklist";
import { ClauseCard } from "@/components/clause-card";
import { ScorecardHero } from "@/components/scorecard-hero";
import { ScrollReveal } from "@/components/scroll-reveal";
import { StatusPulse } from "@/components/status-pulse";
import { StatuteDrawer } from "@/components/statute-drawer";
import { API_BASE, LexGuardApiError } from "@/lib/api";
import type { DocumentScorecard } from "@/lib/types";

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [scorecard, setScorecard] = useState<DocumentScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openStatute, setOpenStatute] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/v1/reports/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            body?.error?.message ||
            (res.status === 404
              ? "Report not found or has expired (24h TTL)."
              : `Failed to load report (${res.status}).`);
          throw new LexGuardApiError(
            body?.error?.code || "fetch_failed",
            res.status,
            msg,
          );
        }
        return body as DocumentScorecard;
      })
      .then((data) => {
        if (!cancelled) setScorecard(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <Header />

      <main className="px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pb-32">
        <section className="pt-20 md:pt-24">
          <p className="label mb-4">shared report · {id}</p>
          <h1 className="display max-w-3xl text-[clamp(2rem,5vw,3.5rem)] text-ink leading-[1.05]">
            Editorial scorecard,
            <br />
            <span className="display-italic">delivered</span> from the extension.
          </h1>
        </section>

        {loading && (
          <p className="label mt-16">Loading report…</p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-12 border border-accent/40 bg-accent-soft px-5 py-4"
          >
            <p className="label text-accent mb-1">report unavailable</p>
            <p className="text-ink-mid text-sm">{error}</p>
            <p className="text-ink-low text-xs mt-3">
              Reports expire after 24 hours. Rescan from{" "}
              <Link href="/" className="underline hover:text-accent">
                the website
              </Link>{" "}
              or the extension to generate a fresh one.
            </p>
          </div>
        )}

        {scorecard && (
          <div className="mt-16 space-y-16">
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
              <ChatPanel
                documentId={scorecard.document_id}
                suggestedQuestions={scorecard.suggested_questions}
                language="en"
              />
            </ScrollReveal>

            <ScrollReveal>
              <Footnote scorecard={scorecard} />
            </ScrollReveal>
          </div>
        )}
      </main>

      <StatuteDrawer
        statuteId={openStatute}
        onClose={() => setOpenStatute(null)}
      />
    </>
  );
}

function Header() {
  return (
    <header className="px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pt-8 flex items-center justify-between flex-wrap gap-y-3">
      <Link href="/" className="flex items-baseline gap-3">
        <span className="display-italic text-2xl">Lex</span>
        <span className="display text-2xl">Guard</span>
      </Link>
      <nav className="flex items-center gap-8">
        <Link
          href="/"
          className="label text-ink-low hover:text-ink-mid transition-colors"
        >
          Single scan
        </Link>
        <Link
          href="/compare"
          className="label text-ink-low hover:text-ink-mid transition-colors"
        >
          Compare
        </Link>
        <StatusPulse label="Shared report" />
      </nav>
    </header>
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
