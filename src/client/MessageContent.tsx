// src/client/MessageContent.tsx
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { api } from "./api";
import type { Row } from "./types";
import {
  formatDateTimeForDisplay,
  formatDateOnlyForDisplay,
} from "../shared/date-detection";
export function displayMentions(
  text: string,
  members: Pick<Row, "id" | "name" | "kyros_user_id">[],
) {
  return text.replace(
    /@\[([0-9a-f-]{36})\]/gi,
    (_, id) =>
      `@${members.find((m) => m.id === id || m.kyros_user_id === id)?.name || "membre"}`,
  );
}
export function replyPreview(
  source: Pick<Row, "content" | "mentions"> | undefined,
  members: Pick<Row, "id" | "name" | "kyros_user_id">[],
) {
  if (!source) return "Réponse à un message précédent";
  return displayMentions(source.content, [
    ...(source.mentions || []),
    ...members,
  ]).slice(0, 90);
}
export function encodeMentions(
  text: string,
  members: Pick<Row, "id" | "name">[],
) {
  let result = text;
  for (const m of [...members].sort((a, b) => b.name.length - a.name.length)) {
    const escaped = m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`@${escaped}(?=$|[\\s,.!?;:])`, "g"),
      `@[${m.id}]`,
    );
  }
  return result;
}
function LinkPreview({ base, url }: { base: string; url: string }) {
  const [data, setData] = useState<{
    title: string;
    description: string;
    host: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api<{ data: typeof data }>(
      `${base}/link-preview?url=${encodeURIComponent(url)}`,
    )
      .then((r) => {
        if (!cancelled) setData(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [base, url]);
  return data ? (
    <a
      className="link-preview"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <small>{data.host}</small>
      <strong>{data.title}</strong>
      {data.description && <span>{data.description}</span>}
    </a>
  ) : null;
}
function ImagePreview({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return !failed ? (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-image"
    >
      <img
        src={src}
        alt={label}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </a>
  ) : null;
}
function AttachmentPreview({ base, url }: { base: string; url: string }) {
  const [file, setFile] = useState<Row | null>(null);
  useEffect(() => {
    void api<{ data: Row }>(`${url}?metadata=true`)
      .then((r) => setFile(r.data))
      .catch(() => {});
  }, [url]);
  return file?.mime.startsWith("image/") ? (
    <ImagePreview src={url} label={file.name} />
  ) : null;
}
export function MessageContent({
  text,
  base,
  channel,
  members = [],
  previews = false,
  detectedDates = [],
  onDateClick,
}: {
  text: string;
  base: string;
  channel: string;
  members?: Pick<Row, "id" | "name" | "kyros_user_id">[];
  previews?: boolean;
  detectedDates?: Array<{
    originalText: string;
    start: Date;
    end?: Date;
    allDay?: boolean;
    timezone?: string;
  }>;
  onDateClick?: (date: {
    originalText: string;
    start: Date;
    end?: Date;
    allDay?: boolean;
    timezone?: string;
  }) => void;
}) {
  const urls = [...new Set(text.match(/https?:\/\/[^\s<>]+/g) || [])].slice(
    0,
    4,
  );
  return (
    <>
      <div className="message-text">
        {text
          .split(/(https?:\/\/[^\s<>]+|@\[[0-9a-f-]{36}\])/gi)
          .map((part, i) =>
            part.startsWith("@[") ? (
              <span className="mention" key={i}>
                {displayMentions(part, members)}
              </span>
            ) : /^https?:/.test(part) ? (
              <a key={i} href={part} target="_blank" rel="noopener noreferrer">
                {part.includes("/attachments/") ? "Pièce jointe" : part}
              </a>
            ) : (
              part
            ),
          )}
      </div>
      {detectedDates.length > 0 && (
        <div className="message-dates" aria-label="Dates détectées">
          {detectedDates.map((d, i) => (
            <button
              key={i}
              type="button"
              className="message-date-badge"
              onClick={() => onDateClick?.(d)}
              aria-label={`Créer un événement pour ${d.allDay ? formatDateOnlyForDisplay(d.start, d.timezone) : formatDateTimeForDisplay(d.start, d.timezone)}`}
            >
              <CalendarDays size={15} aria-hidden="true" />
              <span className="date-badge-text">
                {d.allDay
                  ? formatDateOnlyForDisplay(d.start, d.timezone)
                  : formatDateTimeForDisplay(d.start, d.timezone)}
                {d.end &&
                  ` – ${new Date(d.end).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: d.timezone,
                  })}`}
              </span>
            </button>
          ))}
        </div>
      )}
      {urls.map((url) => {
        let u: URL;
        try {
          u = new URL(url);
        } catch {
          return null;
        }
        if (
          u.origin === location.origin &&
          u.pathname.startsWith(`${base}/attachments/`)
        )
          return <AttachmentPreview key={url} base={base} url={u.pathname} />;
        if (
          /\.(png|jpe?g|webp|gif)$/i.test(u.pathname) &&
          u.protocol === "https:"
        )
          return (
            <ImagePreview
              key={url}
              src={`${base}/channels/${channel}/media?url=${encodeURIComponent(url)}`}
              label="Image partagée dans la conversation"
            />
          );
        return previews && u.protocol === "https:" ? (
          <LinkPreview key={url} base={base} url={url} />
        ) : null;
      })}
    </>
  );
}
