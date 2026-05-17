"use client";

import { useEffect, useRef, useState } from "react";
import { LexGuardApiError, askFollowup } from "@/lib/api";
import type { ChatTurn, Language } from "@/lib/types";

const CLAUSE_RE = /\b(c\d+)\b/g;

export function ChatPanel({
  documentId,
  suggestedQuestions,
  language = "en",
  defaultOpen = true,
}: {
  documentId: string;
  suggestedQuestions: string[];
  language?: Language;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    const nextHistory = [...messages, { role: "user" as const, content: q }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const res = await askFollowup({
        documentId,
        question: q,
        history: messages,
        language,
      });
      setMessages([
        ...nextHistory,
        { role: "assistant", content: res.answer },
      ]);
    } catch (e) {
      const msg =
        e instanceof LexGuardApiError ? e.message : (e as Error).message;
      setError(msg);
      // Roll back the optimistic user turn so retry is clean.
      setMessages(messages);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function scrollToClause(clauseId: string) {
    const el = document.getElementById(`clause-${clauseId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("clause-highlight");
    window.setTimeout(() => el.classList.remove("clause-highlight"), 1800);
  }

  return (
    <section
      className="border-l-2 border-accent pl-6 md:pl-10 py-10 my-4"
      id="chat-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-baseline gap-3 group"
      >
        <span className="label text-accent">ask lexguard about this document</span>
        <span className="h-px flex-1 bg-rule" />
        <span className="label group-hover:text-accent transition-colors">
          {open ? "collapse" : "expand"} {open ? "↑" : "↓"}
        </span>
      </button>
      {open && messages.length === 0 && suggestedQuestions.length > 0 && (
        <p className="text-ink-mid text-base leading-relaxed max-w-2xl mt-4">
          Five agents already scanned this document end-to-end. Anything still on
          your mind? Pick a suggested question or type your own.
        </p>
      )}

      {open && (
        <div className="mt-8 grid gap-6">
          {messages.length === 0 && suggestedQuestions.length > 0 && (
            <div>
              <p className="label mb-4">try one</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    disabled={loading}
                    className="px-3 py-2 text-sm border border-rule rounded-sm text-ink-mid hover:text-ink hover:border-rule-strong transition-colors text-left max-w-[28rem]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div
              ref={threadRef}
              className="max-h-[28rem] overflow-y-auto pr-2 grid gap-6"
              aria-live="polite"
            >
              {messages.map((m, i) => (
                <ChatBubble key={i} turn={m} onClauseClick={scrollToClause} />
              ))}
              {loading && <ThinkingBubble />}
            </div>
          )}

          {error && (
            <p className="text-sm text-accent border-l-2 border-accent pl-3">
              {error}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-3 border-t border-rule pt-4"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about this document…"
              disabled={loading}
              aria-label="Ask LexGuard a follow-up question"
              className="flex-1 bg-transparent border-b border-rule focus:border-accent outline-none text-ink py-2 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || input.trim().length < 2}
              className="px-4 py-2 bg-accent text-bg disabled:bg-ink-faint disabled:text-ink-low transition-colors"
            >
              <span className="label text-bg">{loading ? "…" : "send ↵"}</span>
            </button>
          </form>

          <p className="text-xs text-ink-low leading-relaxed border-t border-rule pt-4">
            Citations refer to clauses in this document only. LexGuard provides
            risk intelligence, not legal advice. Artifacts expire 1 hour after
            scan — rescan to keep asking.
          </p>
        </div>
      )}
    </section>
  );
}

function ChatBubble({
  turn,
  onClauseClick,
}: {
  turn: ChatTurn;
  onClauseClick: (clauseId: string) => void;
}) {
  if (turn.role === "user") {
    return (
      <div className="flex flex-col gap-1 items-end">
        <span className="label">you</span>
        <p className="bg-surface border-l border-rule-strong px-4 py-3 max-w-[36rem] text-ink leading-relaxed text-right">
          {turn.content}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="label">lexguard</span>
      <div className="border-l-2 border-accent pl-4 max-w-[42rem] text-ink-mid leading-relaxed">
        {renderWithCitations(turn.content, onClauseClick)}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex flex-col gap-1">
      <span className="label">lexguard</span>
      <div className="border-l-2 border-accent pl-4 text-ink-low">
        <span className="thinking-dots">thinking</span>
      </div>
    </div>
  );
}

function renderWithCitations(
  text: string,
  onClauseClick: (clauseId: string) => void,
) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CLAUSE_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const id = match[1];
    parts.push(
      <button
        key={`${id}-${start}`}
        type="button"
        onClick={() => onClauseClick(id)}
        className="text-accent underline decoration-rule decoration-1 underline-offset-4 hover:decoration-accent transition-colors"
        title={`Jump to clause ${id}`}
      >
        {id}
      </button>,
    );
    lastIndex = start + id.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
