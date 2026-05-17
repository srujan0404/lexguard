const DEFAULTS = {
  apiBase: "https://lexguard-api-ra2lq6x47q-el.a.run.app",
  webBase: "https://lexguard-srujan0404.vercel.app",
};

const apiInput = document.getElementById("apiBase");
const webInput = document.getElementById("webBase");
const statusEl = document.getElementById("status");

chrome.storage.sync.get(DEFAULTS, (cfg) => {
  apiInput.value = cfg.apiBase;
  webInput.value = cfg.webBase;
});

document.getElementById("save").addEventListener("click", () => {
  const apiBase = apiInput.value.trim() || DEFAULTS.apiBase;
  const webBase = webInput.value.trim() || DEFAULTS.webBase;
  chrome.storage.sync.set({ apiBase, webBase }, () => {
    statusEl.classList.add("saved");
    statusEl.textContent = "Saved.";
    window.setTimeout(() => {
      statusEl.classList.remove("saved");
      statusEl.textContent = "";
    }, 1800);
  });
});
