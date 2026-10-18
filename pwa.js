"use strict";
// PWA lifecycle only: never touches scoring state or localStorage.
(function () {
  const status = document.getElementById("pwa-status");
  const show = text => { status.textContent = text; };
  if (!window.isSecureContext || !("serviceWorker" in navigator)) {
    show("離線安裝需使用 HTTPS 或電腦 localhost；目前仍可正常記分。");
    return;
  }
  const base = new URL("./", document.baseURI);
  navigator.serviceWorker.register(new URL("sw.js", base).href, {
    scope: base.href, updateViaCache: "none"
  }).then(registration => {
    const showWaiting = () => show("新版本已準備，關閉所有記分板分頁及 App 後重開即可更新；比分會保留。");
    if (registration.waiting) showWaiting();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && registration.waiting) showWaiting();
      });
    });
    navigator.serviceWorker.ready.then(() => {
      if (registration.waiting) showWaiting();
      else show("離線資源已準備，可加入主畫面使用。");
    });
    // update() failure while offline is expected; the installed app still works.
    registration.update().catch(() => {});
  }).catch(() => show("離線資源尚未準備好，請連網後重新整理；目前仍可正常記分。"));
})();
