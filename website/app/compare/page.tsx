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
          <p className="label mb-8">compare two documents · side by side</p>

          <h1 className="display max-w-5xl text-[clamp(2.2rem,6vw,5rem)] text-ink leading-[1.02]">
            Two offers.
            <br />
            <span className="display-italic">One</span> is safer.
          </h1>

          <p className="mt-8 max-w-2xl text-ink-mid text-lg leading-relaxed">
            Paste two contracts, policies, or offer letters. Each one runs the
            full five-agent pipeline in parallel, then we hand back a side-by-side
            scorecard with the exact delta — severity by severity, clause by clause.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-px bg-rule max-w-2xl">
            <Step n="01" label="paste both" />
            <Step n="02" label="parallel scan" />
            <Step n="03" label="delta verdict" />
          </div>
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

      <Footer />

      <StatuteDrawer
        statuteId={openStatute}
        onClose={() => setOpenStatute(null)}
      />
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
        <NavPill href="/scan" label="Scan" active={false} />
        <NavPill href="/compare" label="Compare" active />
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

function Step({ n, label }: { n: string; label: string }) {
  return (
    <div className="bg-bg px-4 py-3">
      <span className="display-italic text-2xl text-ink-faint">{n}</span>
      <p className="label mt-2">{label}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pb-12">
      <div className="border-t border-rule pt-8 flex flex-wrap gap-y-3 gap-x-8 items-baseline">
        <span className="label">disclaimer</span>
        <p className="text-ink-mid text-sm max-w-2xl leading-relaxed">
          LexGuard is risk intelligence, not legal advice. It surfaces signals you
          can act on; it does not substitute for a lawyer when stakes are real.
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
