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

const MAX_EXTRACT_CHARS = 60_000;

function detectLegalPage() {
  const url = location.pathname.toLowerCase();
  const urlMatch = LEGAL_URL_PATTERNS.some((p) => url.includes(p));
  if (urlMatch) return { isLegal: true, reason: "url" };

  const text = (document.body?.innerText || "").toLowerCase();
  if (text.length < 200) return { isLegal: false, reason: "too_short" };

  let hits = 0;
  for (const kw of LEGAL_KEYWORDS) {
    if (text.includes(kw)) hits += 1;
  }
  return hits >= 8
    ? { isLegal: true, reason: "keywords", hits }
    : { isLegal: false, reason: "low_density", hits };
}

function extractText() {
  const candidates = [
    document.querySelector("main"),
    document.querySelector("article"),
    document.querySelector('[role="main"]'),
  ].filter(Boolean);
  let root = candidates[0];
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

const detection = detectLegalPage();

if (detection.isLegal) {
  try {
    chrome.runtime.sendMessage({
      type: "PAGE_HAS_LEGAL_TEXT",
      url: location.href,
      title: document.title,
    });
  } catch (err) {
    // service worker may be sleeping - badge update will catch up next time
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "DETECT_LEGAL_TEXT") {
    sendResponse({
      ...detection,
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
