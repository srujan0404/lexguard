const BADGE_COLOR = "#FF4A1F";

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "PAGE_HAS_LEGAL_TEXT") return;
  const tabId = sender.tab?.id;
  if (!tabId) return;
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
  chrome.action.setBadgeText({ tabId, text: "!" });
  chrome.action.setTitle({
    tabId,
    title: "LexGuard detected legal text. Click to scan.",
  });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  // Don't clear - the content script will reassert on each tab if legal.
  // But ensure non-legal pages don't show stale "!" - we let content.js drive.
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }
});
