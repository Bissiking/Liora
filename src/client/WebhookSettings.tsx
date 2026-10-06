// src/client/WebhookSettings.tsx
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "./api";
import { WebhookEmbed } from "./WebhookEmbed";
import {
  webhookMessageSchema,
  type WebhookMessage,
} from "../shared/webhook-message";
import { EntityMenu } from "./ContextMenuProvider";
import type { Row } from "./types";
export function WebhookSettings({
  base,
  rows,
  can,
  refresh,
}: {
  base: string;
  rows: Row[];
  can: (p: string) => boolean;
  refresh: () => void;
}) {
  const [id, setId] = useState(""),
    [mode, setMode] = useState("TEXT"),
    [content, setContent] = useState(""),
    [embed, setEmbed] = useState<Record<string, string>>({}),
    [fields, setFields] = useState<
      Array<{ name: string; value: string; inline: boolean }>
    >([]),
    [metadata, setMetadata] = useState("{}"),
    [history, setHistory] = useState<
      Array<{
        id: string;
        mode: string;
        is_test: boolean;
        http_status: number;
        error: string;
        created_at: string;
      }>
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const selected = rows.find((r) => r.id === id);
  useEffect(() => {
    if (!rows.some((r) => r.id === id))
      setId(rows.find((r) => !r.revoked)?.id || rows[0]?.id || "");
  }, [rows]);
  const load = () =>
    id
      ? api<{ data: typeof history }>(`${base}/webhooks/${id}/history`).then(
          (r) => setHistory(r.data),
        )
      : Promise.resolve();
  useEffect(() => {
    let gone = false;
    setHistory([]);
    if (id)
      void api<{ data: typeof history }>(`${base}/webhooks/${id}/history`)
        .then((r) => {
          if (!gone) setHistory(r.data);
        })
        .catch((e) => {
          if (!gone) setError(e.message);
        });
    return () => {
      gone = true;
    };
  }, [base, id]);
  let preview: WebhookMessage | null = null,
    validation = "";
  try {
    const data =
      mode === "TEXT"
        ? { mode, content, metadata: JSON.parse(metadata) }
        : {
            mode,
            content,
            metadata: JSON.parse(metadata),
            embed: {
              ...Object.fromEntries(
                Object.entries(embed).filter(
                  ([k, v]) =>
                    v &&
                    ![
                      "author_name",
                      "author_url",
                      "author_icon",
                      "footer_text",
                      "footer_icon",
                    ].includes(k),
                ),
              ),
              fields,
              ...(embed.author_name
                ? {
                    author: {
                      name: embed.author_name,
                      ...(embed.author_url ? { url: embed.author_url } : {}),
                      ...(embed.author_icon ? { icon: embed.author_icon } : {}),
                    },
                  }
                : {}),
              ...(embed.footer_text
                ? {
                    footer: {
                      text: embed.footer_text,
                      ...(embed.footer_icon ? { icon: embed.footer_icon } : {}),
                    },
                  }
                : {}),
            },
          };
    preview = webhookMessageSchema.parse(data);
  } catch (e) {
    validation =
      e instanceof SyntaxError
        ? "Les métadonnées doivent être un objet JSON valide."
        : "Complétez le message et vérifiez les longueurs, les dates et les URL HTTPS.";
  }
  const test = async () => {
    if (!preview || !selected || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`${base}/webhooks/${id}/test`, "POST", preview);
      setNotice("Message de test publié dans le canal du webhook.");
      await load();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const field = (key: string, label: string, type = "text") => (
    <label key={key}>
      {label}
      <input
        type={type}
        value={embed[key] || ""}
        onChange={(e) => setEmbed((old) => ({ ...old, [key]: e.target.value }))}
      />
    </label>
  );
  return (
    <div className="webhook-settings">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <label>
        Webhook
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choisir un webhook…</option>
          {rows.map((r) => (
            <option value={r.id} key={r.id}>
              {r.name}
              {r.revoked ? " · révoqué" : ""}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <EntityMenu
          label={selected.name}
          actions={[
            {
              label: "Copier l’ID",
              run: () =>
                void navigator.clipboard
                  .writeText(id)
                  .catch((e) => setError(e.message)),
            },
            ...(!selected.revoked && can("DELETE_WEBHOOK")
              ? [
                  {
                    label: "Révoquer",
                    danger: true,
                    run: () => {
                      if (confirm(`Révoquer ${selected.name} ?`))
                        void api(`${base}/webhooks/${id}`, "DELETE")
                          .then(refresh)
                          .catch((e) => setError(e.message));
                    },
                  },
                ]
              : []),
          ]}
        >
          <p>
            Canal : {selected.channel_id} ·{" "}
            {selected.revoked ? "Révoqué" : "Actif"}
          </p>
        </EntityMenu>
      )}
      <div className="webhook-editor">
        <div className="form">
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="TEXT">TEXT · texte</option>
              <option value="EMBED">EMBED · message enrichi</option>
            </select>
          </label>
          <label>
            {mode === "TEXT" ? "Message" : "Texte d’accompagnement"}
            <textarea
              value={content}
              maxLength={8000}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          {mode === "EMBED" && (
            <>
              {field("title", "Titre")}
              <label>
                Description
                <textarea
                  value={embed.description || ""}
                  maxLength={4000}
                  onChange={(e) =>
                    setEmbed({ ...embed, description: e.target.value })
                  }
                />
              </label>
              {field("color", "Couleur · #RRGGBB")}
              {field("url", "Lien du titre", "url")}
              {field("author_name", "Auteur")}
              {field("author_url", "Lien de l’auteur", "url")}
              {field("author_icon", "Icône de l’auteur", "url")}
              {field("footer_text", "Pied de page")}
              {field("footer_icon", "Icône du pied de page", "url")}
              {field("timestamp", "Date ISO 8601")}
              {field("image", "Image · URL HTTPS", "url")}
              {field("thumbnail", "Miniature · URL HTTPS", "url")}
              {field("icon", "Icône · URL HTTPS", "url")}
              <h3>Champs</h3>
              {fields.map((f, i) => (
                <fieldset key={i}>
                  <legend>Champ {i + 1}</legend>
                  <label>
                    Nom
                    <input
                      value={f.name}
                      onChange={(e) =>
                        setFields(
                          fields.map((r, j) =>
                            i === j ? { ...r, name: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Valeur
                    <textarea
                      value={f.value}
                      onChange={(e) =>
                        setFields(
                          fields.map((r, j) =>
                            i === j ? { ...r, value: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={f.inline}
                      onChange={(e) =>
                        setFields(
                          fields.map((r, j) =>
                            i === j ? { ...r, inline: e.target.checked } : r,
                          ),
                        )
                      }
                    />
                    En ligne
                  </label>
                  <button
                    aria-label={`Retirer le champ ${i + 1}`}
                    onClick={() => setFields(fields.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={16} />
                  </button>
                </fieldset>
              ))}
              <button
                disabled={fields.length >= 25}
                onClick={() =>
                  setFields([...fields, { name: "", value: "", inline: false }])
                }
              >
                <Plus size={17} />
                Ajouter un champ
              </button>
            </>
          )}
          <label>
            Métadonnées additionnelles · JSON
            <textarea
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
            />
          </label>
          {can("MANAGE_WEBHOOK") && (
            <button
              className="primary"
              disabled={busy || !preview || !selected || selected.revoked}
              onClick={() => void test()}
            >
              Publier un test
            </button>
          )}
        </div>
        <section className="webhook-preview">
          <h2>Aperçu live</h2>
          {preview && selected ? (
            <WebhookEmbed
              message={preview}
              base={base}
              channel={selected.channel_id}
            />
          ) : (
            <p className="muted">
              {validation || "Choisissez un webhook pour prévisualiser."}
            </p>
          )}
          <details>
            <summary>Payload générique</summary>
            <pre data-native-menu>
              {preview
                ? JSON.stringify(preview, null, 2)
                : "Message à compléter"}
            </pre>
          </details>
        </section>
      </div>
      <section>
        <h2>Réceptions récentes</h2>
        {history.length ? (
          history.map((h) => (
            <article className="webhook-history" key={h.id}>
              <strong>
                HTTP {h.http_status} · {h.mode}
                {h.is_test ? " · test" : ""}
              </strong>
              <time dateTime={h.created_at}>
                {new Date(h.created_at).toLocaleString("fr-FR")}
              </time>
              {h.error && <p>{h.error}</p>}
            </article>
          ))
        ) : (
          <p className="muted">Aucune réception enregistrée.</p>
        )}
      </section>
    </div>
  );
}
