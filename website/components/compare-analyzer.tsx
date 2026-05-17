"use client";

import { useState } from "react";
import { LexGuardApiError, analyzeText } from "@/lib/api";
import type { DocumentScorecard, Domain, Language } from "@/lib/types";

const DOMAINS: { value: Domain; label: string }[] = [
  { value: "employment", label: "Employment" },
  { value: "privacy", label: "Privacy" },
  { value: "ticketing", label: "Ticketing" },
  { value: "consumer", label: "Consumer" },
  { value: "rental", label: "Rental" },
  { value: "generic", label: "Generic" },
];

export interface ComparePair {
  a: DocumentScorecard;
  b: DocumentScorecard;
  labelA: string;
  labelB: string;
}

export function CompareAnalyzer({
  onResult,
  onError,
}: {
  onResult: (pair: ComparePair) => void;
  onError: (e: { message: string }) => void;
}) {
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [labelA, setLabelA] = useState("Document A");
  const [labelB, setLabelB] = useState("Document B");
  const [domain, setDomain] = useState<Domain>("employment");
  const [language, setLanguage] = useState<Language>("en");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (textA.trim().length < 20 || textB.trim().length < 20) {
      onError({ message: "Both documents need at least 20 characters." });
      return;
    }
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        analyzeText({ text: textA, domain_hint: domain, language }),
        analyzeText({ text: textB, domain_hint: domain, language }),
      ]);
      onResult({ a, b, labelA, labelB });
    } catch (e) {
      const msg = e instanceof LexGuardApiError ? e.message : (e as Error).message;
      onError({ message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-t border-rule pt-10">
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <DocColumn
          letter="A"
          label={labelA}
          onLabelChange={setLabelA}
          text={textA}
          onTextChange={setTextA}
        />
        <DocColumn
          letter="B"
          label={labelB}
          onLabelChange={setLabelB}
          text={textB}
          onTextChange={setTextB}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6">
        <div className="flex items-center gap-3">
          <span className="label">Domain</span>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as Domain)}
            className="bg-surface border border-rule rounded-sm px-3 py-1.5 text-ink text-sm focus:border-rule-strong focus:outline-none"
          >
            {DOMAINS.map((o) => (
              <option key={o.value} value={o.value} className="bg-bg">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="label">Output</span>
          <div className="flex gap-1">
            <ToggleButton active={language === "en"} onClick={() => setLanguage("en")}>
              English
            </ToggleButton>
            <ToggleButton
              active={language === "hinglish"}
              onClick={() => setLanguage("hinglish")}
            >
              Hinglish
            </ToggleButton>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="ml-auto group inline-flex items-center gap-3 px-5 py-3 bg-accent text-bg disabled:bg-ink-faint disabled:text-ink-low transition-colors"
        >
          <span className="label text-bg">
            {loading ? "Scanning both documents…" : "Compare"}
          </span>
          <span aria-hidden className="text-bg">
            {loading ? "…" : "↵"}
          </span>
        </button>
      </div>

      {loading && (
        <p className="label mt-6 text-ink-mid">
          Each side runs a full 5-agent pipeline in parallel. ~1 minute total.
        </p>
      )}
    </section>
  );
}

function DocColumn({
  letter,
  label,
  onLabelChange,
  text,
  onTextChange,
}: {
  letter: "A" | "B";
  label: string;
  onLabelChange: (v: string) => void;
  text: string;
  onTextChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="display-italic text-4xl text-ink-faint">{letter}</span>
        <input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          aria-label={`Label for document ${letter}`}
          className="flex-1 bg-transparent border-b border-rule focus:border-accent outline-none text-ink text-lg py-1 transition-colors"
          placeholder={`Document ${letter}`}
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Paste contract / offer letter / policy…"
        rows={12}
        className="w-full bg-surface border border-rule rounded-sm px-5 py-4 text-ink placeholder:text-ink-faint resize-y focus:border-rule-strong focus:outline-none transition-colors"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 text-sm border transition-colors ${
        active
          ? "border-accent text-ink"
          : "border-rule text-ink-low hover:text-ink-mid"
      }`}
    >
      {children}
    </button>
  );
}
