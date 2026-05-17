const DEFAULT_API_BASE = "https://lexguard-api-ra2lq6x47q-el.a.run.app";
const DEFAULT_WEB_BASE = "https://lexguard-srujan0404.vercel.app";

const CACHE_PREFIX = "lg:scan:";
const POLL_INTERVAL_MS = 1500;
const STALLED_SCAN_MS = 40 * 1000;

const LOADING_PHRASES = [
  "Reading the fine print",
  "Comparing against Indian civil law",
  "Sending the red-team agent in",
  "Drafting your safer version",
];

const SEVERITY_TONE = ["low", "medium", "high", "critical"];

const TICKETING_HOSTS = [
  "bookmyshow",
  "paytm",
  "ticketmaster",
  "insider",
  "district",
  "zomato",
  "skyscanner",
  "makemytrip",
  "irctc",
  "redbus",
  "ola",
  "uber",
];

function inferDomain(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "generic";
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (TICKETING_HOSTS.some((h) => host.includes(h))) return "ticketing";
  if (/\/(showtimes|seat-layout|booking|tickets|cinema|event|movie|train|flight)/.test(path))
    return "ticketing";
  if (/(privacy|gdpr|dpdp)/.test(path)) return "privacy";
  if (/\/(careers|jobs|offer-letter|employment|hr|hiring|internship)/.test(path))
    return "employment";
  if (/\/(lease|rental|tenant|landlord|rent-agreement)/.test(path)) return "rental";
  if (/\/(terms|conditions|tos|eula|return|refund|policy|legal|warranty|disclaimer)/.test(path))
    return "consumer";
  return "generic";
}

const els = {
  pageTitle: document.getElementById("page-title"),
  statusLabel: document.getElementById("status-label"),
  statusDot: document.querySelector("#status .pulse-dot"),
  domain: document.getElementById("domain"),
  scan: document.getElementById("scan"),
  scanLabel: document.getElementById("scan-label"),
  result: document.getElementById("result"),
  severityPill: document.getElementById("severity-pill"),
  riskScore: document.getElementById("risk-score"),
  recycledBanner: document.getElementById("recycled-banner"),
  recycledText: document.getElementById("recycled-text"),
  counts: document.getElementById("counts"),
  concernsList: document.getElementById("concerns-list"),
  openFull: document.getElementById("open-full"),
  errorBox: document.getElementById("error-box"),
  errorMsg: document.getElementById("error-msg"),
  optionsLink: document.getElementById("options-link"),
  cacheNote: document.getElementById("cache-note"),
  emptyNotice: document.getElementById("empty-notice"),
};

let phraseTimer = null;
let pollTimer = null;
let currentTabUrl = null;
let currentWebBase = DEFAULT_WEB_BASE;

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { apiBase: DEFAULT_API_BASE, webBase: DEFAULT_WEB_BASE },
      resolve,
    );
  });
}

function activeTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((t) => t[0]);
}

function cacheKey(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return CACHE_PREFIX + u.toString();
  } catch {
    return CACHE_PREFIX + url;
  }
}

function readEntry(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(cacheKey(url), (items) => {
      resolve(items[cacheKey(url)] || null);
    });
  });
}

function clearEntry(url) {
  chrome.storage.local.remove(cacheKey(url));
}

function formatAge(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min === 1) return "1 minute ago";
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
}

async function ensureContentInjected(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch {
    throw new Error("This page does not allow extensions.");
  }
}

function sendMessage(tabId, msg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (r) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(r);
    });
  });
}

async function detectOnTab(tabId) {
  try {
    await ensureContentInjected(tabId);
    return await sendMessage(tabId, { type: "DETECT_LEGAL_TEXT" });
  } catch {
    return null;
  }
}

async function extractFromTab(tabId) {
  await ensureContentInjected(tabId);
  const r = await sendMessage(tabId, { type: "EXTRACT_TEXT" });
  if (!r?.text || r.text.length < 200) {
    throw new Error("No readable text on this page.");
  }
  return r;
}

function severityClass(s) {
  return SEVERITY_TONE.includes(s) ? s : "low";
}

function renderResult(scorecard, opts = {}) {
  els.errorBox.hidden = true;
  els.result.hidden = false;
  els.emptyNotice.hidden = true;

  const sev = severityClass(scorecard.overall_severity);
  els.severityPill.className = `pill ${sev}`;
  els.severityPill.innerHTML = `<span class="dot"></span>${sev}`;

  els.riskScore.textContent = String(scorecard.risk_score);
  els.riskScore.classList.toggle("critical", sev === "critical");

  if (scorecard.seen_before > 0) {
    els.recycledBanner.hidden = false;
    const issuer = scorecard.issuer_name ? ` (${scorecard.issuer_name})` : "";
    const noun = scorecard.seen_before === 1 ? "other scan" : "other scans";
    els.recycledText.textContent = `Seen in ${scorecard.seen_before} ${noun}${issuer}.`;
  } else {
    els.recycledBanner.hidden = true;
  }

  els.counts.innerHTML = SEVERITY_TONE.map(
    (s) =>
      `<div><span class="label">${s}</span><span class="num">${
        scorecard.counts[s] ?? 0
      }</span></div>`,
  ).join("");

  const concerns = (scorecard.top_concerns || []).slice(0, 3);
  els.concernsList.innerHTML = concerns
    .map(
      (c, i) =>
        `<li><span class="index">${String(i + 1).padStart(2, "0")}</span><span>${c}</span></li>`,
    )
    .join("");

  if (opts.ageMs != null) {
    els.cacheNote.hidden = false;
    els.cacheNote.textContent = `Cached · scanned ${formatAge(opts.ageMs)}. Click Scan to refresh.`;
    els.scanLabel.textContent = "Scan again";
  } else {
    els.cacheNote.hidden = true;
    els.scanLabel.textContent = "Scan this page";
  }
}

function renderError(msg) {
  els.result.hidden = true;
  els.emptyNotice.hidden = true;
  els.errorBox.hidden = false;
  els.errorMsg.textContent = msg;
  els.scanLabel.textContent = "Scan this page";
}

function renderEmptyState(detection) {
  els.emptyNotice.hidden = false;
  let body;
  if (detection?.reason === "too_short") {
    body =
      "Not enough text on this page to analyze. Open a page with terms, a policy, or an agreement.";
  } else {
    const hits = detection?.hits ?? 0;
    body = `Found only ${hits} legal-ish ${hits === 1 ? "keyword" : "keywords"} and no terms/policy headings. Most likely a regular page. Scan anyway if you're sure.`;
  }
  els.emptyNotice.innerHTML = `
    <span class="label">No legal text detected</span>
    <p>${body}</p>
  `;
  els.statusLabel.textContent = "Nothing to flag";
  els.scanLabel.textContent = "Scan anyway";
  els.scan.classList.add("muted");
}

function startLoadingUI() {
  els.scan.disabled = true;
  els.errorBox.hidden = true;
  els.emptyNotice.hidden = true;
  let i = 0;
  els.scanLabel.textContent = LOADING_PHRASES[0];
  if (phraseTimer) window.clearInterval(phraseTimer);
  phraseTimer = window.setInterval(() => {
    i = (i + 1) % LOADING_PHRASES.length;
    els.scanLabel.textContent = LOADING_PHRASES[i];
  }, 2400);
}

function stopLoadingUI() {
  els.scan.disabled = false;
  if (phraseTimer) {
    window.clearInterval(phraseTimer);
    phraseTimer = null;
  }
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function applyEntry(entry) {
  if (!entry) return false;
  if (entry.status === "scanning") {
    startLoadingUI();
    return true;
  }
  stopLoadingUI();
  stopPolling();
  if (entry.status === "done" && entry.scorecard) {
    renderResult(entry.scorecard, { ageMs: Date.now() - (entry.savedAt || Date.now()) });
    if (entry.reportId) {
      els.openFull.href = `${currentWebBase}/r/${entry.reportId}`;
    } else {
      els.openFull.href = currentWebBase;
    }
    return true;
  }
  if (entry.status === "error") {
    renderError(entry.error || "Scan failed.");
    return true;
  }
  return false;
}

function startPolling(url) {
  stopPolling();
  pollTimer = window.setInterval(async () => {
    const entry = await readEntry(url);
    if (!entry) {
      stopPolling();
      stopLoadingUI();
      return;
    }
    if (entry.status === "scanning") {
      const lastActivity = entry.lastActivity || entry.startedAt || 0;
      if (Date.now() - lastActivity > STALLED_SCAN_MS) {
        stopPolling();
        stopLoadingUI();
        clearEntry(url);
        renderError(
          "Scan stalled. Chrome may have suspended the background worker. Click Scan to retry.",
        );
      }
      return;
    }
    stopPolling();
    applyEntry(entry);
  }, POLL_INTERVAL_MS);
}

async function scan() {
  const tab = await activeTab();
  if (!tab?.id || !tab?.url) {
    renderError("No active tab.");
    return;
  }
  els.scan.classList.remove("muted");
  els.errorBox.hidden = true;
  els.cacheNote.hidden = true;
  els.emptyNotice.hidden = true;
  clearEntry(tab.url);

  startLoadingUI();
  try {
    const extracted = await extractFromTab(tab.id);
    chrome.runtime.sendMessage({
      type: "START_SCAN",
      payload: {
        url: tab.url,
        text: extracted.text,
        domain: els.domain.value,
        language: "en",
      },
    });
    startPolling(tab.url);
  } catch (err) {
    stopLoadingUI();
    renderError(err?.message || "Unexpected error.");
  }
}

async function init() {
  const tab = await activeTab();
  if (!tab) return;
  currentTabUrl = tab.url;
  els.pageTitle.textContent = tab.title || tab.url || "—";

  if (!/^https?:\/\//.test(tab.url || "")) {
    els.statusLabel.textContent = "Unavailable on this page";
    els.scan.disabled = true;
    els.scanLabel.textContent = "Open a web page first";
    return;
  }

  const cfg = await getConfig();
  currentWebBase = cfg.webBase;
  els.openFull.href = currentWebBase;

  const inferred = inferDomain(tab.url);
  if (inferred && inferred !== "generic") {
    els.domain.value = inferred;
  }

  const entry = await readEntry(tab.url);
  if (entry?.status === "scanning") {
    const lastActivity = entry.lastActivity || entry.startedAt || 0;
    if (Date.now() - lastActivity > STALLED_SCAN_MS) {
      clearEntry(tab.url);
      els.statusLabel.textContent = "Previous scan stalled";
      renderError(
        "The previous scan was suspended by Chrome. Click Scan to retry.",
      );
    } else {
      els.statusDot.classList.add("live");
      els.statusLabel.textContent = "Scan in progress";
      startLoadingUI();
      startPolling(tab.url);
    }
    return;
  }
  if (entry?.status === "done" && entry.scorecard) {
    els.statusDot.classList.add("live");
    els.statusLabel.textContent = "Cached scan";
    applyEntry(entry);
    return;
  }
  if (entry?.status === "error") {
    els.statusLabel.textContent = "Previous scan failed";
    renderError(entry.error || "Scan failed.");
    return;
  }

  const det = await detectOnTab(tab.id);
  if (det?.isLegal) {
    els.statusDot.classList.add("live");
    els.statusLabel.textContent = "Legal text detected";
  } else if (det) {
    renderEmptyState(det);
  } else {
    els.statusLabel.textContent = "Ready";
  }
}

els.scan.addEventListener("click", scan);
els.optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
});

window.addEventListener("unload", stopPolling);

init();
