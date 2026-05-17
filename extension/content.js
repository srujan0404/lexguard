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
  /\bterms\s*(&|and|&amp;)\s*conditions?\b/i,
  /\bterms\s+of\s+(use|service)\b/i,
  /\bprivacy\s+(policy|notice)\b/i,
  /\buser\s+agreement\b/i,
  /\bcookie\s+(policy|notice)\b/i,
  /\brefund\s+policy\b/i,
  /\bcancellation\s+policy\b/i,
  /\bend\s+user\s+licen[cs]e\b/i,
  /\beula\b/i,
  /\bdisclaimer\b/i,
  /\bpublic\s+notice\b/i,
  /\bdata\s+protection\b/i,
];

const KEYWORD_THRESHOLD = 4;
const MAX_EXTRACT_CHARS = 60_000;
const MIN_LEGAL_ROOT_CHARS = 500;
const MAX_LEGAL_ROOT_CHARS = 100_000;

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

function matchesAnyStrongPattern(text) {
  if (!text) return null;
  for (const re of STRONG_HEADING_PATTERNS) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

// Find the smallest element whose innerText contains a legal heading phrase AND
// has enough surrounding text to be worth scanning. This catches T&C content
// inside custom-class modals (BookMyShow, Razorpay checkout, etc.).
function findLegalRoot() {
  if (!document.body) return null;
  const all = document.body.querySelectorAll("*");
  let best = null;
  let bestLen = Infinity;
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (!(el instanceof HTMLElement)) continue;
    const txt = el.innerText;
    if (!txt) continue;
    const len = txt.length;
    if (len < MIN_LEGAL_ROOT_CHARS || len > MAX_LEGAL_ROOT_CHARS) continue;
    if (!matchesAnyStrongPattern(txt)) continue;
    if (len < bestLen) {
      best = el;
      bestLen = len;
    }
  }
  return best;
}

function detectLegalPage() {
  const url = location.pathname.toLowerCase();
  if (LEGAL_URL_PATTERNS.some((p) => url.includes(p))) {
    return { isLegal: true, reason: "url" };
  }

  const title = (document.title || "").toLowerCase();
  const titleMatch = matchesAnyStrongPattern(title);
  if (titleMatch) return { isLegal: true, reason: "title", match: titleMatch };

  const modal = visibleModal();
  if (modal) {
    const modalText = (modal.innerText || "").slice(0, 8000);
    const modalMatch = matchesAnyStrongPattern(modalText);
    if (modalMatch) return { isLegal: true, reason: "modal", match: modalMatch };
  }

  const headings = document.querySelectorAll(
    "h1, h2, h3, [role='heading'], [role='dialog']",
  );
  for (const h of headings) {
    const txt = (h.innerText || "").trim();
    if (!txt || txt.length > 120) continue;
    const m = matchesAnyStrongPattern(txt);
    if (m) return { isLegal: true, reason: "heading", match: m };
  }

  const text = (document.body?.innerText || "").toLowerCase();
  if (text.length < 200) return { isLegal: false, reason: "too_short", hits: 0 };

  // Body-text phrase scan - catches custom-class modal headings (e.g. BookMyShow
  // renders the T&C heading as <div class="sc-*">Terms & Conditions</div>).
  const bodyMatch = matchesAnyStrongPattern(text);
  if (bodyMatch) {
    return { isLegal: true, reason: "body_phrase", match: bodyMatch };
  }

  let hits = 0;
  for (const kw of LEGAL_KEYWORDS) if (text.includes(kw)) hits += 1;
  return hits >= KEYWORD_THRESHOLD
    ? { isLegal: true, reason: "keywords", hits }
    : { isLegal: false, reason: "low_density", hits };
}

function extractText() {
  // 1. Visible modal element first - covers <dialog> / role=dialog cases.
  const modal = visibleModal();
  if (modal) {
    const t = (modal.innerText || "").trim();
    if (t.length > 200) {
      return t.length > MAX_EXTRACT_CHARS ? t.slice(0, MAX_EXTRACT_CHARS) : t;
    }
  }

  // 2. Smallest DOM element whose text contains a legal heading phrase and has
  //    enough chars to be substantive. Wins on BookMyShow-style modals where
  //    the dialog uses custom CSS classes instead of role=dialog.
  const root = findLegalRoot();
  if (root) {
    const t = (root.innerText || "").trim();
    if (t.length > 200) {
      return t.length > MAX_EXTRACT_CHARS ? t.slice(0, MAX_EXTRACT_CHARS) : t;
    }
  }

  // 3. Standard main/article/body fallback.
  const roots = [
    document.querySelector("main"),
    document.querySelector("article"),
    document.querySelector('[role="main"]'),
  ].filter(Boolean);

  let fallback = roots[0];
  if (!fallback) {
    const divs = Array.from(document.body?.querySelectorAll("div") || []);
    fallback = divs.reduce(
      (best, d) =>
        d.innerText && d.innerText.length > (best?.innerText?.length || 0) ? d : best,
      document.body,
    );
  }
  const raw = (fallback?.innerText || document.body?.innerText || "").trim();
  return raw.length > MAX_EXTRACT_CHARS ? raw.slice(0, MAX_EXTRACT_CHARS) : raw;
}

const detection = detectLegalPage();
if (detection.isLegal) {
  try {
    chrome.runtime.sendMessage({
      type: "PAGE_HAS_LEGAL_TEXT",
      url: location.href,
      title: document.title,
    });
  } catch {
    // service worker may be sleeping - badge will catch up next click
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "DETECT_LEGAL_TEXT") {
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
