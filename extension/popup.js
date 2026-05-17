const DEFAULT_API_BASE = "https://lexguard-api-ra2lq6x47q-el.a.run.app";
const DEFAULT_WEB_BASE = "https://lexguard-srujan0404.vercel.app";

const CACHE_PREFIX = "lg:scan:";
const CACHE_TTL_MS = 60 * 60 * 1000;

const LOADING_PHRASES = [
  "Reading the fine print",
  "Comparing against Indian civil law",
  "Sending the red-team agent in",
  "Drafting your safer version",
];

const SEVERITY_TONE = ["low", "medium", "high", "critical"];

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
};

let phraseTimer = null;

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

function readCache(url) {
  return new Promise((resolve) => {
    const k = cacheKey(url);
    chrome.storage.local.get(k, (items) => {
      const entry = items[k];
      if (!entry || Date.now() - entry.savedAt > CACHE_TTL_MS) {
        if (entry) chrome.storage.local.remove(k);
        return resolve(null);
      }
      resolve(entry);
    });
  });
}

function writeCache(url, scorecard) {
  chrome.storage.local.set({
    [cacheKey(url)]: { url, scorecard, savedAt: Date.now() },
  });
  // Evict anything stale on every write.
  chrome.storage.local.get(null, (items) => {
    const now = Date.now();
    const stale = Object.entries(items)
      .filter(
        ([k, v]) =>
          k.startsWith(CACHE_PREFIX) && v?.savedAt && now - v.savedAt > CACHE_TTL_MS,
      )
      .map(([k]) => k);
    if (stale.length) chrome.storage.local.remove(stale);
  });
}

function clearCache(url) {
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
  } catch (err) {
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
  els.errorBox.hidden = false;
  els.errorMsg.textContent = msg;
}

function startLoading() {
  els.scan.disabled = true;
  let i = 0;
  els.scanLabel.textContent = LOADING_PHRASES[0];
  phraseTimer = window.setInterval(() => {
    i = (i + 1) % LOADING_PHRASES.length;
    els.scanLabel.textContent = LOADING_PHRASES[i];
  }, 2400);
}

function stopLoading() {
  els.scan.disabled = false;
  if (phraseTimer) {
    window.clearInterval(phraseTimer);
    phraseTimer = null;
  }
}

async function scan() {
  const cfg = await getConfig();
  const tab = await activeTab();
  if (!tab?.id || !tab?.url) {
    renderError("No active tab.");
    return;
  }
  els.errorBox.hidden = true;
  els.cacheNote.hidden = true;
  clearCache(tab.url);
  startLoading();
  try {
    const extracted = await extractFromTab(tab.id);
    const res = await fetch(`${cfg.apiBase}/api/v1/analyze/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: extracted.text,
        domain_hint: els.domain.value,
        language: "en",
        source_url: extracted.url,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.error?.message || `Request failed (${res.status}).`;
      renderError(msg);
      els.scanLabel.textContent = "Scan this page";
      return;
    }
    writeCache(tab.url, body);
    renderResult(body);
    els.openFull.href = cfg.webBase;
  } catch (err) {
    renderError(err.message || "Unexpected error.");
    els.scanLabel.textContent = "Scan this page";
  } finally {
    stopLoading();
  }
}

async function init() {
  const tab = await activeTab();
  if (!tab) return;
  els.pageTitle.textContent = tab.title || tab.url || "—";

  if (!/^https?:\/\//.test(tab.url || "")) {
    els.statusLabel.textContent = "Unavailable on this page";
    els.scan.disabled = true;
    els.scanLabel.textContent = "Open a web page first";
    return;
  }

  const cfg = await getConfig();
  els.openFull.href = cfg.webBase;

  const cached = await readCache(tab.url);
  if (cached) {
    els.statusDot.classList.add("live");
    els.statusLabel.textContent = "Cached scan";
    renderResult(cached.scorecard, { ageMs: Date.now() - cached.savedAt });
    return;
  }

  const det = await detectOnTab(tab.id);
  if (det?.isLegal) {
    els.statusDot.classList.add("live");
    els.statusLabel.textContent = "Legal text detected";
  } else {
    els.statusLabel.textContent = "Scan anyway";
  }
}

els.scan.addEventListener("click", scan);
els.optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
});

init();
