"use client";

import Link from "next/link";
import { useState } from "react";
import { AgentsShowcase } from "@/components/agents-showcase";
import { AuroraBg } from "@/components/aurora-bg";
import { ScrollReveal } from "@/components/scroll-reveal";
import { StatusPulse } from "@/components/status-pulse";
import { StatutesShowcase } from "@/components/statutes-showcase";
import { StatuteDrawer } from "@/components/statute-drawer";
import { TryNowButton } from "@/components/try-now-button";

export default function Page() {
  const [openStatute, setOpenStatute] = useState<string | null>(null);

  return (
    <>
      <Header active="home" />

      <main className="px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pb-32">
        <Hero />

        <ScrollReveal className="mt-24">
          <AgentsShowcase />
        </ScrollReveal>

        <ScrollReveal className="mt-20">
          <StatutesShowcase onOpen={setOpenStatute} />
        </ScrollReveal>

        <ScrollReveal className="mt-24">
          <ClosingCta />
        </ScrollReveal>
      </main>

      <Footer />

      <StatuteDrawer
        statuteId={openStatute}
        onClose={() => setOpenStatute(null)}
      />
    </>
  );
}

function Header({ active }: { active: "home" | "scan" | "compare" }) {
  return (
    <header className="relative z-10 px-6 md:px-12 lg:px-16 max-w-6xl mx-auto pt-8 flex items-center justify-between flex-wrap gap-y-3">
      <Link href="/" className="flex items-baseline gap-3">
        <span className="display-italic text-2xl">Lex</span>
        <span className="display text-2xl">Guard</span>
      </Link>
      <nav className="flex items-center gap-1 border border-rule rounded-full p-1">
        <NavPill href="/" label="Home" active={active === "home"} />
        <NavPill href="/scan" label="Scan" active={active === "scan"} />
        <NavPill href="/compare" label="Compare" active={active === "compare"} />
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

function Hero() {
  return (
    <section className="relative pt-20 md:pt-32 overflow-hidden">
      <AuroraBg />

      <div className="relative z-10">
        <p className="label mb-8">an adversarial AI consent firewall</p>

        <h1 className="display max-w-4xl text-[clamp(2.5rem,7vw,6rem)] text-ink">
          Read it{" "}
          <span className="display-italic">before</span>
          <br />
          you sign it.
        </h1>

        <p className="mt-10 max-w-2xl text-ink-mid text-lg leading-relaxed">
          Five AI agents read the contract, ground every flag in Indian civil
          law, argue from both sides, and hand back a structured scorecard.
          Built for the 40-page privacy policy nobody reads and the offer letter
          you're about to sign at 11&nbsp;pm.
        </p>

        <div className="mt-12 flex flex-col md:flex-row md:items-center gap-8">
          <TryNowButton />
          <Link
            href="/compare"
            className="label text-ink-low hover:text-ink-mid transition-colors"
          >
            or compare two documents →
          </Link>
        </div>

        <div className="mt-14 flex items-center gap-8 flex-wrap text-ink-low">
          <Stat label="agents" value="5" />
          <Stat label="risk categories" value="19" />
          <Stat label="indian statutes indexed" value="24" />
          <Stat label="not legal advice" value="∞" italic />
        </div>
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
        className={`text-3xl text-ink ${italic ? "display-italic" : "display"}`}
      >
        {value}
      </span>
      <span className="label">{label}</span>
    </div>
  );
}

function ClosingCta() {
  return (
    <section className="border-t border-rule pt-20 text-center">
      <p className="label mb-6">ready when you are</p>
      <h2 className="display text-[clamp(2rem,5vw,3.6rem)] text-ink max-w-3xl mx-auto leading-[1.05]">
        Paste a contract. <span className="display-italic">Get the verdict.</span>
      </h2>
      <p className="mt-6 max-w-xl mx-auto text-ink-mid leading-relaxed">
        About a minute end-to-end. Free. Grounded in Indian civil law. Not legal
        advice, just signals you can act on.
      </p>
      <div className="mt-10 flex justify-center">
        <TryNowButton />
      </div>
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
