"use client";

import { useState } from "react";
import type { ClauseVerdict } from "@/lib/types";
import { SeverityPill } from "./severity-pill";

export function ClauseCard({
  clause,
  index,
}: {
  clause: ClauseVerdict;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="border-t border-rule first:border-t-0 group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left py-6 grid grid-cols-[3rem_auto_1fr_auto] items-center gap-5 transition-opacity hover:opacity-95"
      >
        <span className="label text-ink-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <SeverityPill severity={clause.severity} />
        <h3 className="display text-2xl md:text-3xl text-ink truncate">
          {clause.title}
        </h3>
        <span
          className={`label transition-transform duration-300 ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden
        >
          ›
        </span>
      </button>

      {open && (
        <div className="pb-10 grid md:grid-cols-[14rem_1fr] gap-x-8 gap-y-6">
          <Field label="Plain language">
            <p className="text-ink text-lg leading-relaxed max-w-2xl">
              {clause.plain_language}
            </p>
          </Field>

          <Field label="Why it matters">
            <p className="text-ink-mid leading-relaxed max-w-2xl">
              {clause.why_it_matters}
            </p>
          </Field>

          <Field label="What to do">
            <p className="text-ink leading-relaxed max-w-2xl">
              <span className="text-accent">→ </span>
              {clause.what_to_do}
            </p>
          </Field>

          {clause.safer_version && (
            <Field label="Safer rewrite">
              <blockquote className="border-l-2 border-rule-strong pl-4 text-ink-mid italic max-w-2xl leading-relaxed">
                {clause.safer_version}
              </blockquote>
            </Field>
          )}

          {clause.statutes_cited.length > 0 && (
            <Field label="Indian statutes">
              <ul className="space-y-1.5 max-w-2xl">
                {clause.statutes_cited.map((s) => (
                  <li key={s} className="text-ink-mid text-sm leading-relaxed">
                    <span className="text-ink-faint mr-2">§</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Field>
          )}

          {clause.risk_categories.length > 0 && (
            <Field label="Categories">
              <div className="flex flex-wrap gap-2">
                {clause.risk_categories.map((c) => (
                  <span
                    key={c}
                    className="label-wide px-2.5 py-1 ring-1 ring-inset ring-rule rounded-full"
                  >
                    {c.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </Field>
          )}

          <Field label="Confidence">
            <ConfidenceBar value={clause.confidence} />
          </Field>
        </div>
      )}
    </article>
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
    <>
      <span className="label md:pt-1.5">{label}</span>
      <div>{children}</div>
    </>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3 max-w-xs">
      <div className="relative h-px flex-1 bg-rule">
        <span
          className="absolute inset-y-0 left-0 bg-ink-mid"
          style={{ width: `${pct}%`, height: "1px" }}
        />
      </div>
      <span className="label">{pct}%</span>
    </div>
  );
}
