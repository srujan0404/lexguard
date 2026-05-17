"use client";

import Link from "next/link";
import { useState } from "react";
import { CompareAnalyzer, type ComparePair } from "@/components/compare-analyzer";
import { CompareResult } from "@/components/compare-result";
import { ScrollReveal } from "@/components/scroll-reveal";
import { StatusPulse } from "@/components/status-pulse";
import { StatuteDrawer } from "@/components/statute-drawer";

export default function ComparePage() {
  const [pair, setPair] = useState<ComparePair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openStatute, setOpenStatute] = useState<string | null>(null);

  return (
    <>
      <Header />

      <main className="px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pb-32">
        <section className="pt-20 md:pt-28">
          <p className="label mb-8">compare two documents</p>
          <h1 className="display max-w-4xl text-[clamp(2.2rem,6vw,5rem)] text-ink leading-[1.02]">
            Two offers.
            <br />
            <span className="display-italic">One</span> is safer.
          </h1>
          <p className="mt-8 max-w-2xl text-ink-mid text-lg leading-relaxed">
            Paste two contracts, policies, or offer letters. Each one runs the
            full five-agent pipeline in parallel, then we hand back a side-by-side
            scorecard with the exact delta.
          </p>
        </section>

        <ScrollReveal className="mt-16">
          <CompareAnalyzer
            onResult={(p) => {
              setError(null);
              setPair(p);
              requestAnimationFrame(() => {
                document
                  .getElementById("compare-results")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
            onError={(e) => {
              setPair(null);
              setError(e.message);
            }}
          />
        </ScrollReveal>

        {error && (
          <div
            role="alert"
            className="mt-10 border border-accent/40 bg-accent-soft px-5 py-4"
          >
            <p className="label text-accent mb-1">compare failed</p>
            <p className="text-ink-mid text-sm">{error}</p>
          </div>
        )}

        {pair && (
          <div id="compare-results" className="mt-20">
            <ScrollReveal>
              <CompareResult
                a={pair.a}
                b={pair.b}
                labelA={pair.labelA}
                labelB={pair.labelB}
                onStatuteClick={setOpenStatute}
              />
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
        <span className="label text-ink">Compare</span>
        <StatusPulse label="Cloud Run / asia-south1" />
      </nav>
    </header>
  );
}
