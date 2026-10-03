// src/client/Inbox.tsx
import { useState } from "react";
import { Bell, CheckCheck, Archive, ArrowRight } from "lucide-react";
import { api } from "./api";
import { Empty } from "./ui";
import type { Row } from "./types";
export function Inbox({
  base,
  notifications,
  refresh,
  fail,
  openChannel,
}: {
  base: string;
  notifications: Row[];
  refresh: () => void;
  fail: (e: unknown) => void;
  openChannel: (id: string) => void;
}) {
  const [filter, setFilter] = useState("unread");
  const [busy, setBusy] = useState(false);
  const unread = notifications.filter((n) => n.state === "unread");
  const visible = notifications.filter((n) =>
    filter === "all"
      ? n.state !== "dismissed"
      : filter === "read"
        ? n.state === "read"
        : n.state === "unread",
  );
  async function update(rows: Row[], state: string) {
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        rows.map((n) =>
          api(`${base}/notifications/${n.id}`, "PATCH", { state }),
        ),
      );
      const rejected = results.find((r) => r.status === "rejected");
      if (rejected?.status === "rejected") fail(rejected.reason);
    } finally {
      refresh();
      setBusy(false);
    }
  }
  return (
    <div className="page inbox-page">
      <header className="page-heading">
        <div>
          <h1>Votre boîte de réception</h1>
          <p>Mentions, tâches et alertes : retrouvez ce qui vous concerne.</p>
        </div>
        <button
          disabled={busy || !unread.length}
          onClick={() => void update(unread, "read")}
        >
          <CheckCheck size={18} />
          Tout marquer comme lu
        </button>
      </header>
      <nav className="view-tabs" aria-label="Filtrer les notifications">
        {[
          ["unread", `Non lues${unread.length ? ` (${unread.length})` : ""}`],
          ["all", "Toutes"],
          ["read", "Lues"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={filter === id ? "page" : undefined}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {!visible.length ? (
        <Empty
          title={
            filter === "unread" ? "Vous êtes à jour" : "Aucune notification"
          }
        >
          Les mentions, tâches attribuées et alertes apparaîtront ici.
        </Empty>
      ) : (
        visible.map((n) => (
          <article className={`notification ${n.state}`} key={n.id}>
            <Bell size={20} />
            <div>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <time dateTime={n.created_at}>
                {new Date(n.created_at).toLocaleString("fr-FR")}
              </time>
              {n.channel_id && (
                <button
                  className="notification-open"
                  onClick={() => openChannel(n.channel_id)}
                >
                  Ouvrir la conversation <ArrowRight size={16} />
                </button>
              )}
            </div>
            {n.state !== "dismissed" && (
              <button
                disabled={busy}
                onClick={() =>
                  void update([n], n.state === "unread" ? "read" : "dismissed")
                }
              >
                {n.state === "unread" ? (
                  <CheckCheck size={17} />
                ) : (
                  <Archive size={17} />
                )}
                {n.state === "unread" ? "Marquer comme lue" : "Archiver"}
              </button>
            )}
          </article>
        ))
      )}
    </div>
  );
}
