// src/client/PushSettings.tsx
import { useEffect, useState } from "react";
import { api } from "./api";
export function PushSettings({ base }: { base: string }) {
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const [enabled, setEnabled] = useState(false),
    [subscribed, setSubscribed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [key, setKey] = useState("");
  useEffect(() => {
    let gone = false;
    void api<{ enabled: boolean; key: string; subscribed: boolean }>(
      `${base}/push/vapid-public-key`,
    )
      .then(async (r) => {
        if (gone) return;
        setEnabled(r.enabled);
        setKey(r.key);
        const registration = supported
          ? await navigator.serviceWorker.getRegistration()
          : null;
        const sub = await registration?.pushManager.getSubscription();
        if (!gone)
          setSubscribed(
            r.subscribed && !!sub && Notification.permission === "granted",
          );
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    return () => {
      gone = true;
    };
  }, [base]);
  async function action(kind: "enable" | "disable" | "test") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (kind === "test") {
        await api(`${base}/push/test`, "POST");
        setMessage(
          "Test mis en file. La notification arrivera au prochain cycle d’envoi.",
        );
        return;
      }
      if (kind === "disable") {
        const registration = await navigator.serviceWorker.getRegistration();
        const sub = await registration?.pushManager.getSubscription();
        await api(
          `${base}/push/subscribe`,
          "DELETE",
          sub ? { endpoint: sub.endpoint } : {},
        );
        await sub?.unsubscribe();
        setSubscribed(false);
        setMessage("Notifications désactivées sur cet appareil.");
        return;
      }
      if ((await Notification.requestPermission()) !== "granted")
        throw Error(
          "Notifications refusées. Vous pouvez modifier cette autorisation dans les réglages du navigateur.",
        );
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active)
        throw Error(
          "L’installation de l’application est en cours. Rechargez puis réessayez.",
        );
      const bytes = Uint8Array.from(
        atob(key.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      );
      let sub = await registration.pushManager.getSubscription();
      if (
        sub?.options.applicationServerKey &&
        Array.from(new Uint8Array(sub.options.applicationServerKey)).join() !==
          Array.from(bytes).join()
      ) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ||= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      await api(`${base}/push/subscribe`, "POST", sub.toJSON());
      setSubscribed(true);
      setMessage("Notifications activées sur cet appareil pour cette session.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="push-settings">
      <h3>Notifications sur cet appareil</h3>
      <p>
        {!supported
          ? "Ce navigateur ne prend pas en charge les notifications push. Sur iPhone ou iPad, ouvrez Liora depuis son icône ajoutée à l’écran d’accueil."
          : !enabled
            ? "L’administrateur doit configurer le service d’envoi avant l’activation."
            : subscribed
              ? "Activées. Leur accès est révoqué avec cette session."
              : "Recevez une alerte même lorsque Liora est fermé. Le contenu des messages reste dans l’application."}
      </p>
      {supported && (
        <div className="row-actions">
          {!subscribed ? (
            <button
              type="button"
              disabled={busy || !enabled}
              onClick={() => void action("enable")}
            >
              Activer sur cet appareil
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void action("disable")}
              >
                Désactiver sur cet appareil
              </button>
              <button
                type="button"
                disabled={busy || !enabled}
                onClick={() => void action("test")}
              >
                Envoyer un test
              </button>
            </>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
