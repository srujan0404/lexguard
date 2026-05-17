const BADGE_COLOR = "#FF4A1F";
const CACHE_PREFIX = "lg:scan:";
const CACHE_TTL_MS = 60 * 60 * 1000;
const STALE_SCAN_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 15 * 1000;
const SCAN_TIMEOUT_MS = 4 * 60 * 1000;

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
    chrome.storage.local.get(cacheKey(url), (items) => resolve(items[cacheKey(url)] || null));
  });
}

function writeEntry(url, entry) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [cacheKey(url)]: entry }, resolve);
  });
}

async function touchHeartbeat(url) {
  const e = await readEntry(url);
  if (e && e.status === "scanning") {
    await writeEntry(url, { ...e, lastActivity: Date.now() });
  }
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        apiBase: "https://lexguard-api-ra2lq6x47q-el.a.run.app",
        webBase: "https://lexguard-srujan0404.vercel.app",
      },
      resolve,
    );
  });
}

async function performScan({ url, text, domain, language }) {
  const startedAt = Date.now();
  await writeEntry(url, {
    status: "scanning",
    startedAt,
    lastActivity: startedAt,
    url,
  });

  const heartbeat = setInterval(() => touchHeartbeat(url), HEARTBEAT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  const cfg = await getConfig();
  try {
    const res = await fetch(`${cfg.apiBase}/api/v1/analyze/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        domain_hint: domain,
        language,
        source_url: url,
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.error?.message || `Request failed (${res.status}).`;
      await writeEntry(url, {
        status: "error",
        error: msg,
        savedAt: Date.now(),
        url,
      });
      return;
    }

    let reportId;
    try {
      const r = await fetch(`${cfg.apiBase}/api/v1/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) reportId = (await r.json()).id;
    } catch {
      // non-fatal; "Open full report" falls back to bare website
    }

    await writeEntry(url, {
      status: "done",
      scorecard: body,
      reportId,
      savedAt: Date.now(),
      url,
    });
    evictStale();
  } catch (err) {
    const aborted = err?.name === "AbortError";
    await writeEntry(url, {
      status: "error",
      error: aborted
        ? "Scan exceeded 4-minute timeout. Try again or scan a shorter document."
        : err?.message || "Network error.",
      savedAt: Date.now(),
      url,
    });
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timeoutId);
  }
}

async function runScan(payload) {
  // navigator.locks keeps the MV3 service worker alive while the callback runs.
  if (navigator?.locks?.request) {
    return navigator.locks.request("lg-scan", { mode: "shared" }, () =>
      performScan(payload),
    );
  }
  return performScan(payload);
}

function evictStale() {
  chrome.storage.local.get(null, (items) => {
    const now = Date.now();
    const stale = Object.entries(items)
      .filter(([k, v]) => {
        if (!k.startsWith(CACHE_PREFIX) || !v) return false;
        if (v.status === "done" || v.status === "error") {
          return v.savedAt && now - v.savedAt > CACHE_TTL_MS;
        }
        if (v.status === "scanning") {
          return v.startedAt && now - v.startedAt > STALE_SCAN_MS;
        }
        return false;
      })
      .map(([k]) => k);
    if (stale.length) chrome.storage.local.remove(stale);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PAGE_HAS_LEGAL_TEXT") {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    chrome.action.setBadgeText({ tabId, text: "!" });
    chrome.action.setTitle({
      tabId,
      title: "LexGuard detected legal text. Click to scan.",
    });
    return false;
  }

  if (msg?.type === "START_SCAN") {
    runScan(msg.payload);
    sendResponse({ ok: true });
    return false;
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }
});
