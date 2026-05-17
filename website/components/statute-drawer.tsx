"use client";

import { useEffect, useState } from "react";
import { getStatute } from "@/lib/api";
import type { Statute } from "@/lib/types";

export function StatuteDrawer({
  statuteId,
  onClose,
}: {
  statuteId: string | null;
  onClose: () => void;
}) {
  const [statute, setStatute] = useState<Statute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!statuteId) {
      setStatute(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStatute(statuteId)
      .then((s) => {
        if (!cancelled) setStatute(s);
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
  }, [statuteId]);

  useEffect(() => {
    if (!statuteId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [statuteId, onClose]);

  const open = statuteId !== null;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-bg/70 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        role="dialog"
        aria-label="Statute detail"
        aria-modal="true"
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[36rem] bg-surface border-l border-rule-strong overflow-y-auto transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-rule px-8 py-5 flex items-center justify-between">
          <span className="label">Indian civil statute</span>
          <button
            type="button"
            onClick={onClose}
            className="label hover:text-accent transition-colors"
            aria-label="Close drawer"
          >
            close ✕
          </button>
        </div>

        <div className="px-8 py-10">
          {loading && <p className="label">Loading…</p>}

          {error && (
            <div className="border border-accent/40 bg-accent-soft px-4 py-3">
              <p className="label text-accent mb-1">lookup failed</p>
              <p className="text-ink-mid text-sm">{error}</p>
            </div>
          )}

          {statute && (
            <article className="space-y-8">
              <header className="space-y-3">
                <p className="label">
                  {statute.act} <span className="text-ink-faint">·</span> §
                  {statute.section}
                </p>
                <h2 className="display text-4xl text-ink leading-[1.05]">
                  {statute.title}
                </h2>
              </header>

              <section className="space-y-3">
                <span className="label">Plain summary</span>
                <p className="text-ink text-lg leading-relaxed">
                  {statute.summary}
                </p>
              </section>

              {statute.applies_to.length > 0 && (
                <section className="space-y-3">
                  <span className="label">Risk categories it covers</span>
                  <div className="flex flex-wrap gap-2">
                    {statute.applies_to.map((c) => (
                      <span
                        key={c}
                        className="label-wide px-2.5 py-1 ring-1 ring-inset ring-rule rounded-full"
                      >
                        {c.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {statute.domains.length > 0 && (
                <section className="space-y-3">
                  <span className="label">Domains</span>
                  <div className="flex flex-wrap gap-2">
                    {statute.domains.map((d) => (
                      <span
                        key={d}
                        className="label-wide px-2.5 py-1 ring-1 ring-inset ring-rule rounded-full"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <footer className="pt-6 border-t border-rule">
                <p className="text-ink-low text-xs leading-relaxed">
                  Summaries are LexGuard's own paraphrase of the statute,
                  curated for plain-English understanding. Always read the
                  actual text of the law on{" "}
                  <a
                    href="https://www.indiacode.nic.in"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-accent transition-colors underline decoration-rule underline-offset-4"
                  >
                    indiacode.nic.in
                  </a>{" "}
                  before relying on it.
                </p>
              </footer>
            </article>
          )}
        </div>
      </aside>
    </>
  );
}
