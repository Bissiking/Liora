// src/client/WebhookEmbed.tsx
import { Markdown } from "./Markdown";
import type { WebhookMessage } from "../shared/webhook-message";
export function WebhookEmbed({
  message,
  base,
  channel,
}: {
  message: WebhookMessage;
  base: string;
  channel: string;
}) {
  if (message.mode === "TEXT") return <Markdown text={message.content} />;
  const e = message.embed,
    src = (url: string) =>
      `${base}/channels/${channel}/media?url=${encodeURIComponent(url)}`;
  const image = (url: string, kind: string) => (
    <img
      className={`embed-${kind}`}
      src={src(url)}
      alt={kind === "image" ? "Image du message" : ""}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
  return (
    <div className="webhook-message">
      {message.content && <Markdown text={message.content} />}
      <article
        className="webhook-embed"
        style={{ borderTopColor: e.color || "var(--accent)" }}
      >
        {e.author && (
          <div className="embed-author">
            {e.author.icon && image(e.author.icon, "icon")}
            {e.author.url ? (
              <a href={e.author.url} rel="noreferrer" target="_blank">
                {e.author.name}
              </a>
            ) : (
              e.author.name
            )}
          </div>
        )}
        {e.icon && image(e.icon, "icon")}
        {e.thumbnail && image(e.thumbnail, "thumbnail")}
        {e.title && (
          <h3>
            {e.url ? (
              <a href={e.url} target="_blank" rel="noreferrer">
                {e.title}
              </a>
            ) : (
              e.title
            )}
          </h3>
        )}
        {e.description && <Markdown text={e.description} />}
        <dl className="embed-fields">
          {e.fields.map((f, i) => (
            <div key={i} className={f.inline ? "inline" : ""}>
              <dt>{f.name}</dt>
              <dd>
                <Markdown text={f.value} />
              </dd>
            </div>
          ))}
        </dl>
        {e.image && image(e.image, "image")}
        {(e.footer || e.timestamp) && (
          <footer>
            {e.footer?.icon && image(e.footer.icon, "icon")}
            <span>{e.footer?.text}</span>
            {e.timestamp && (
              <time dateTime={e.timestamp}>
                {new Date(e.timestamp).toLocaleString("fr-FR")}
              </time>
            )}
          </footer>
        )}
      </article>
    </div>
  );
}
