"use client";

import { useRef, useState } from "react";
import { audioUrl } from "@/lib/api";
import type { Language } from "@/lib/types";

type State = "idle" | "loading" | "playing" | "error";

export function ListenButton({ documentId }: { documentId: string }) {
  const [state, setState] = useState<State>("idle");
  const [lang, setLang] = useState<Language>("en");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  }

  async function play() {
    if (state === "playing") {
      stop();
      return;
    }
    setState("loading");
    const a = new Audio(audioUrl(documentId, lang));
    audioRef.current = a;
    a.addEventListener("playing", () => setState("playing"));
    a.addEventListener("ended", () => setState("idle"));
    a.addEventListener("error", () => setState("error"));
    try {
      await a.play();
    } catch {
      setState("error");
    }
  }

  const isPlaying = state === "playing";
  const isLoading = state === "loading";

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={play}
        disabled={isLoading}
        aria-label={isPlaying ? "Stop listening" : "Listen to the verdict"}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
          isPlaying
            ? "bg-accent text-bg border-accent"
            : "border-rule-strong text-ink hover:border-accent hover:text-accent"
        }`}
      >
        <span aria-hidden className="text-base leading-none">
          {isPlaying ? "■" : isLoading ? "…" : "▸"}
        </span>
        <span
          className="label"
          style={{ color: "inherit" }}
        >
          {isPlaying ? "Stop" : isLoading ? "Loading" : "Listen"}
        </span>
      </button>

      <div className="inline-flex rounded-full border border-rule bg-surface overflow-hidden">
        <LangPill active={lang === "en"} onClick={() => setLang("en")} disabled={isPlaying}>
          EN
        </LangPill>
        <span aria-hidden className="w-px self-stretch bg-rule" />
        <LangPill
          active={lang === "hinglish"}
          onClick={() => setLang("hinglish")}
          disabled={isPlaying}
        >
          HI
        </LangPill>
      </div>

      {state === "error" && (
        <span className="label text-accent">audio unavailable</span>
      )}
    </div>
  );
}

function LangPill({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`label px-3 py-1.5 transition-colors disabled:opacity-50 ${
        active
          ? "bg-accent"
          : "text-ink-low hover:text-ink-mid hover:bg-surface-2"
      }`}
      style={active ? { color: "var(--color-bg)" } : undefined}
    >
      {children}
    </button>
  );
}
