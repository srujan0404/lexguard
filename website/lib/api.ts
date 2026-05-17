import type {
  ApiError,
  ChatTurn,
  DocumentScorecard,
  Domain,
  FollowupResponse,
  Language,
  Statute,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_LEXGUARD_API_URL ??
  "https://lexguard-api-ra2lq6x47q-el.a.run.app";

export class LexGuardApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new LexGuardApiError(
      err?.code ?? "request_failed",
      res.status,
      err?.message ?? `Request failed with status ${res.status}`,
      err?.request_id,
    );
  }
  if (!body) throw new LexGuardApiError("empty_response", res.status, "Empty response from API");
  return body as T;
}

export interface AnalyzeTextInput {
  text: string;
  domain_hint?: Domain;
  language?: Language;
}

export async function analyzeText({
  text,
  domain_hint = "generic",
  language = "en",
}: AnalyzeTextInput): Promise<DocumentScorecard> {
  const res = await fetch(`${API_BASE}/api/v1/analyze/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, domain_hint, language }),
  });
  return parse<DocumentScorecard>(res);
}

export async function analyzePdf(
  file: File,
  domain_hint: Domain = "generic",
  language: Language = "en",
): Promise<DocumentScorecard> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("domain_hint", domain_hint);
  fd.append("language", language);
  const res = await fetch(`${API_BASE}/api/v1/analyze/pdf`, {
    method: "POST",
    body: fd,
  });
  return parse<DocumentScorecard>(res);
}

export async function analyzeUrl(
  url: string,
  domain_hint: Domain = "generic",
  language: Language = "en",
): Promise<DocumentScorecard> {
  const res = await fetch(`${API_BASE}/api/v1/analyze/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, domain_hint, language }),
  });
  return parse<DocumentScorecard>(res);
}

const _statuteCache = new Map<string, Promise<Statute>>();

export function getStatute(id: string): Promise<Statute> {
  let cached = _statuteCache.get(id);
  if (!cached) {
    cached = fetch(`${API_BASE}/api/v1/statutes/${encodeURIComponent(id)}`).then(parse<Statute>);
    _statuteCache.set(id, cached);
  }
  return cached;
}

export async function askFollowup({
  documentId,
  question,
  history,
  language = "en",
}: {
  documentId: string;
  question: string;
  history: ChatTurn[];
  language?: Language;
}): Promise<FollowupResponse> {
  const res = await fetch(
    `${API_BASE}/api/v1/scans/${encodeURIComponent(documentId)}/followup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history, language }),
    },
  );
  return parse<FollowupResponse>(res);
}

export async function getSuggestedQuestions(documentId: string): Promise<string[]> {
  const res = await fetch(
    `${API_BASE}/api/v1/scans/${encodeURIComponent(documentId)}/suggestions`,
  );
  const body = await parse<{ suggestions: string[] }>(res);
  return body.suggestions;
}

export function audioUrl(documentId: string, lang: "en" | "hinglish" = "en"): string {
  return `${API_BASE}/api/v1/scans/${encodeURIComponent(documentId)}/audio?lang=${lang}`;
}
