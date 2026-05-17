"use client";

import { useState } from "react";
import {
  LexGuardApiError,
  analyzePdf,
  analyzeText,
  analyzeUrl,
} from "@/lib/api";
import { SAMPLE_EMPLOYMENT_OFFER } from "@/lib/sample";
import type { DocumentScorecard, Domain, Language } from "@/lib/types";

type Mode = "text" | "pdf" | "url";

const DOMAINS: { value: Domain; label: string }[] = [
  { value: "employment", label: "Employment" },
  { value: "privacy", label: "Privacy" },
  { value: "ticketing", label: "Ticketing" },
  { value: "consumer", label: "Consumer" },
  { value: "rental", label: "Rental" },
  { value: "generic", label: "Generic" },
];

const LOADING_PHRASES = [
  "Reading the fine print",
  "Comparing against Indian civil law",
  "Sending the red-team agent in",
  "Drafting your safer version",
];

export function Analyzer({
  onResult,
  onError,
}: {
  onResult: (s: DocumentScorecard) => void;
  onError: (e: { message: string; requestId?: string }) => void;
}) {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [domain, setDomain] = useState<Domain>("employment");
  const [language, setLanguage] = useState<Language>("en");
  const [loading, setLoading] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  async function submit() {
    setLoading(true);
    let i = 0;
    setPhraseIndex(0);
    const tick = window.setInterval(() => {
      i = (i + 1) % LOADING_PHRASES.length;
      setPhraseIndex(i);
    }, 2400);

    try {
      let result: DocumentScorecard;
      if (mode === "text") {
        if (text.trim().length < 20) {
          throw new LexGuardApiError(
            "too_short",
            422,
            "Paste at least 20 characters of text.",
          );
        }
        result = await analyzeText({ text, domain_hint: domain, language });
      } else if (mode === "url") {
        if (!/^https?:\/\//i.test(url.trim())) {
          throw new LexGuardApiError(
            "bad_url",
            422,
            "URL must start with http:// or https://",
          );
        }
        result = await analyzeUrl(url.trim(), domain, language);
      } else {
        if (!file) {
          throw new LexGuardApiError("no_file", 422, "Choose a PDF first.");
        }
        result = await analyzePdf(file, domain, language);
      }
      onResult(result);
    } catch (e) {
      if (e instanceof LexGuardApiError) {
        onError({ message: e.message, requestId: e.requestId });
      } else if (e instanceof Error) {
        onError({ message: e.message });
      } else {
        onError({ message: "Unknown error." });
      }
    } finally {
      window.clearInterval(tick);
      setLoading(false);
    }
  }

  function loadSample() {
    setMode("text");
    setText(SAMPLE_EMPLOYMENT_OFFER);
    setDomain("employment");
  }

  return (
    <section className="border-t border-rule pt-10">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-y-4 gap-x-6">
        <Tabs mode={mode} onChange={setMode} />
        <button
          type="button"
          onClick={loadSample}
          className="label hover:text-accent transition-colors"
        >
          → Try a sample
        </button>
      </div>

      <div className="grid gap-6">
        {mode === "text" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the contract, policy, or ticket terms here. We accept the messy stuff."
            rows={10}
            className="w-full bg-surface border border-rule rounded-sm px-5 py-4 text-ink placeholder:text-ink-faint resize-y focus:border-rule-strong focus:outline-none transition-colors"
          />
        )}

        {mode === "url" && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/terms"
            className="w-full bg-surface border border-rule rounded-sm px-5 py-4 text-ink placeholder:text-ink-faint focus:border-rule-strong focus:outline-none transition-colors"
          />
        )}

        {mode === "pdf" && (
          <label className="w-full bg-surface border border-dashed border-rule-strong rounded-sm px-5 py-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent transition-colors">
            <span className="label">
              {file ? file.name : "Drop a PDF or click to choose"}
            </span>
            <span className="text-ink-low text-xs">
              Digital PDFs only. Scanned PDFs need OCR which v1 skips for budget reasons.
            </span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        )}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <Field label="Domain">
            <Select
              value={domain}
              onChange={(v) => setDomain(v as Domain)}
              options={DOMAINS}
            />
          </Field>

          <Field label="Output">
            <div className="flex gap-1">
              <ToggleButton
                active={language === "en"}
                onClick={() => setLanguage("en")}
              >
                English
              </ToggleButton>
              <ToggleButton
                active={language === "hinglish"}
                onClick={() => setLanguage("hinglish")}
              >
                Hinglish
              </ToggleButton>
            </div>
          </Field>

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="ml-auto group inline-flex items-center gap-3 px-5 py-3 bg-accent text-bg disabled:bg-ink-faint disabled:text-ink-low transition-colors"
          >
            <span className="label text-bg">
              {loading ? LOADING_PHRASES[phraseIndex] : "Scan"}
            </span>
            <span aria-hidden className="text-bg">
              {loading ? "…" : "↵"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Tabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const tabs: { value: Mode; label: string }[] = [
    { value: "text", label: "Paste text" },
    { value: "pdf", label: "Upload PDF" },
    { value: "url", label: "Paste URL" },
  ];
  return (
    <div role="tablist" className="flex gap-6">
      {tabs.map((t) => {
        const active = mode === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className="relative pb-2 transition-colors"
          >
            <span className={`label ${active ? "text-ink" : "text-ink-low"}`}>
              {t.label}
            </span>
            <span
              className={`absolute -bottom-px left-0 h-px transition-all ${
                active ? "w-full bg-accent" : "w-0 bg-transparent"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface border border-rule rounded-sm px-3 py-1.5 text-ink text-sm focus:border-rule-strong focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-bg">
          {o.label}
        </option>
      ))}
    </select>
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
