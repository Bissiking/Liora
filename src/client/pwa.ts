// src/client/pwa.ts
let registration: ServiceWorkerRegistration | undefined;
export async function applyPwaUpdate() {
  const current =
    registration || (await navigator.serviceWorker.getRegistration());
  if (!current?.waiting) {
    location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => location.reload(),
    { once: true },
  );
  current.waiting.postMessage({ type: "SKIP_WAITING" });
}
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((r) => {
        registration = r;
        const notify = () =>
          window.dispatchEvent(new Event("liora:update-ready"));
        if (r.waiting) notify();
        r.addEventListener("updatefound", () => {
          const worker = r.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              notify();
          });
        });
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible")
            void r.update().catch(() => {});
        });
      })
      .catch(() => {
        /* App remains usable online if installation is unavailable. */
      });
  });
}
