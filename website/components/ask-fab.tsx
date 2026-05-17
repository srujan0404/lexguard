"use client";

import { useEffect, useState } from "react";

export function AskFab({ targetId = "chat-panel" }: { targetId?: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.2 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [targetId]);

  function jump() {
    const t = document.getElementById(targetId);
    if (!t) return;
    t.scrollIntoView({ behavior: "smooth", block: "start" });
    const expandTrigger = t.querySelector<HTMLButtonElement>("button[aria-expanded]");
    if (expandTrigger && expandTrigger.getAttribute("aria-expanded") === "false") {
      expandTrigger.click();
    }
    window.setTimeout(() => {
      const input = t.querySelector<HTMLInputElement>('input[aria-label]');
      input?.focus();
    }, 600);
  }

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={jump}
      className="ask-fab"
      aria-label="Jump to the LexGuard chat about this document"
    >
      <span className="label text-bg">Ask LexGuard</span>
      <span aria-hidden className="text-bg">↓</span>
    </button>
  );
}
