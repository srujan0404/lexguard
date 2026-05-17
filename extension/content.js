// Auto-detects legal-looking pages and exposes EXTRACT_TEXT for the popup.
// Never sends data anywhere on its own - a user click is required.

if (window.__lexguardContentLoaded) {
  // already injected on this page - bail to avoid duplicate listeners
} else {
  window.__lexguardContentLoaded = true;

const LEGAL_URL_PATTERNS = [
  "/terms",
  "/privacy",
  "/policy",
  "/tos",
  "/eula",
  "/legal",
  "/agreement",
  "/conditions",
  "/refund",
  "/cookies",
];

const LEGAL_KEYWORDS = [
  "terms",
  "privacy",
  "policy",
  "consent",
  "agreement",
  "indemnify",
  "indemnification",
  "arbitration",
  "warrant",
  "warranty",
  "non-refundable",
  "liability",
  "waive",
  "waiver",
  "governing law",
  "jurisdiction",
];

const STRONG_HEADING_PATTERNS = [
  /\bterms\s*(&|and)\s*conditions?\b/i,
  /\bterms\s+of\s+(use|service)\b/i,
  /\bprivacy\s+policy\b/i,
  /\bprivacy\s+notice\b/i,
  /\buser\s+agreement\b/i,
  /\bcookie\s+(policy|notice)\b/i,
  /\brefund\s+policy\b/i,
  /\bcancellation\s+policy\b/i,
  /\bend\s+user\s+licen[cs]e\b/i,
  /\beula\b/i,
  /\bdisclaimer\b/i,
  /\bpublic\s+notice\b/i,
];

const KEYWORD_THRESHOLD = 4;
const MAX_EXTRACT_CHARS = 60_000;

const MODAL_SELECTORS = [
  "dialog[open]",
  "[role='dialog']",
  "[aria-modal='true']",
  ".modal.show",
  ".modal--show",
  ".modal[open]",
  "[data-modal-state='open']",
];

function isVisible(el) {
  if (!el) return false;
  if (el.offsetParent === null && el !== document.body) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function visibleModal() {
  for (const sel of MODAL_SELECTORS) {
    const candidates = document.querySelectorAll(sel);
    for (const c of candidates) {
      if (isVisible(c) && (c.innerText || "").trim().length > 80) return c;
    }
  }
  return null;
}

function detectLegalPage() {
  const url = location.pathname.toLowerCase();
  if (LEGAL_URL_PATTERNS.some((p) => url.includes(p))) {
    return { isLegal: true, reason: "url" };
  }

  const title = (document.title || "").toLowerCase();
  for (const re of STRONG_HEADING_PATTERNS) {
    if (re.test(title)) return { isLegal: true, reason: "title", match: title.slice(0, 80) };
  }

  // Modal / dialog headings (often a "Terms & Conditions" overlay on otherwise
  // non-legal pages like checkout flows or movie booking).
  const modal = visibleModal();
  if (modal) {
    const modalText = (modal.innerText || "").slice(0, 4000);
    for (const re of STRONG_HEADING_PATTERNS) {
      if (re.test(modalText)) {
        return { isLegal: true, reason: "modal", match: modalText.slice(0, 120) };
      }
    }
  }

  // Section headings anywhere on the page.
  const headings = document.querySelectorAll(
    "h1, h2, h3, [role='heading'], [role='dialog']",
  );
  for (const h of headings) {
    const txt = (h.innerText || "").trim();
    if (!txt || txt.length > 120) continue;
    for (const re of STRONG_HEADING_PATTERNS) {
      if (re.test(txt)) return { isLegal: true, reason: "heading", match: txt };
    }
  }

  const text = (document.body?.innerText || "").toLowerCase();
  if (text.length < 200) return { isLegal: false, reason: "too_short", hits: 0 };

  let hits = 0;
  for (const kw of LEGAL_KEYWORDS) if (text.includes(kw)) hits += 1;

  return hits >= KEYWORD_THRESHOLD
    ? { isLegal: true, reason: "keywords", hits }
    : { isLegal: false, reason: "low_density", hits };
}

function extractText() {
  // Prefer a visible modal - that's usually what the user wants scanned.
  const modal = visibleModal();
  if (modal) {
    const t = (modal.innerText || "").trim();
    if (t.length > 200) {
      return t.length > MAX_EXTRACT_CHARS ? t.slice(0, MAX_EXTRACT_CHARS) : t;
    }
  }

  const roots = [
    document.querySelector("main"),
    document.querySelector("article"),
    document.querySelector('[role="main"]'),
  ].filter(Boolean);

  let root = roots[0];
  if (!root) {
    const divs = Array.from(document.body?.querySelectorAll("div") || []);
    root = divs.reduce(
      (best, d) =>
        d.innerText && d.innerText.length > (best?.innerText?.length || 0) ? d : best,
      document.body,
    );
  }
  const raw = (root?.innerText || document.body?.innerText || "").trim();
  return raw.length > MAX_EXTRACT_CHARS ? raw.slice(0, MAX_EXTRACT_CHARS) : raw;
}

// Run an initial detection so the badge lights up for clearly-legal pages.
const detection = detectLegalPage();
if (detection.isLegal) {
  try {
    chrome.runtime.sendMessage({
      type: "PAGE_HAS_LEGAL_TEXT",
      url: location.href,
      title: document.title,
    });
  } catch {
    // service worker may be sleeping - badge will catch up on next click
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "DETECT_LEGAL_TEXT") {
    // Re-detect now in case the DOM has changed (modal opened, content loaded).
    const fresh = detectLegalPage();
    sendResponse({
      ...fresh,
      title: document.title,
      url: location.href,
    });
    return false;
  }
  if (msg?.type === "EXTRACT_TEXT") {
    sendResponse({
      text: extractText(),
      title: document.title,
      url: location.href,
    });
    return false;
  }
});

}  // end window.__lexguardContentLoaded guard
