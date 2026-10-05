// src/client/Markdown.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useId, useRef, useState, type RefObject } from "react";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName: string; hProperties: { className: string } };
};
function remarkUnderline() {
  return (tree: unknown) => {
    const visit = (node: MarkdownNode) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== "text" || !child.value) {
          visit(child);
          return [child];
        }
        const parts: MarkdownNode[] = [];
        let offset = 0;
        for (const m of child.value.matchAll(/\+\+([^+\n]+)\+\+/g)) {
          if (m.index > offset)
            parts.push({
              type: "text",
              value: child.value.slice(offset, m.index),
            });
          parts.push({
            type: "lioraUnderline",
            data: {
              hName: "u",
              hProperties: { className: "markdown-underline" },
            },
            children: [{ type: "text", value: m[1] }],
          });
          offset = m.index + m[0].length;
        }
        if (!parts.length) return [child];
        if (offset < child.value.length)
          parts.push({ type: "text", value: child.value.slice(offset) });
        return parts;
      });
    };
    visit(tree as MarkdownNode);
  };
}
function remarkMentions(names: Record<string, string>) {
  return (tree: unknown) => {
    const visit = (node: MarkdownNode) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== "text" || !child.value) {
          visit(child);
          return [child];
        }
        const parts: MarkdownNode[] = [];
        let offset = 0;
        for (const match of child.value.matchAll(/@\[([0-9a-f-]{36})\]/gi)) {
          if (match.index > offset)
            parts.push({
              type: "text",
              value: child.value.slice(offset, match.index),
            });
          parts.push({
            type: "lioraMention",
            data: { hName: "span", hProperties: { className: "mention" } },
            children: [
              { type: "text", value: `@${names[match[1]] || "membre"}` },
            ],
          });
          offset = match.index + match[0].length;
        }
        if (!parts.length) return [child];
        if (offset < child.value.length)
          parts.push({ type: "text", value: child.value.slice(offset) });
        return parts;
      });
    };
    visit(tree as MarkdownNode);
  };
}

export function Markdown({
  text,
  className = "",
  mentionNames,
}: {
  text: string;
  className?: string;
  mentionNames?: Record<string, string>;
}) {
  return (
    <div className={`markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={
          mentionNames
            ? [remarkGfm, remarkUnderline, [remarkMentions, mentionNames]]
            : [remarkGfm, remarkUnderline]
        }
        skipHtml
        urlTransform={(url) =>
          /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url) ? url : ""
        }
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          img: ({ alt }) => <span className="muted">{alt || "Image"}</span>,
          input: ({ node, ...props }) => <input {...props} disabled />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
export function MarkdownToolbar({
  value,
  onChange,
  textareaRef,
}: {
  value: string;
  onChange: (v: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const insert = (before: string, after = "", line = false) => {
    const field = textareaRef.current;
    if (!field) return;
    let start = field.selectionStart,
      end = field.selectionEnd;
    if (line) start = value.lastIndexOf("\n", start - 1) + 1;
    const selected = value.slice(start, end);
    const added = line
      ? selected
          .split("\n")
          .map((t) => before + t)
          .join("\n")
      : before + selected + after;
    const next = value.slice(0, start) + added + value.slice(end);
    if (next.length > (field.maxLength > 0 ? field.maxLength : 20000)) return;
    onChange(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(
        start + before.length,
        start + added.length - after.length,
      );
    });
  };
  const actions = [
    ["Gras", "**", "**", false],
    ["Italique", "*", "*", false],
    ["Souligner", "++", "++", false],
    ["Barrer", "~~", "~~", false],
    ["Titre 1", "# ", "", true],
    ["Titre 2", "## ", "", true],
    ["Titre 3", "### ", "", true],
    ["Citation", "> ", "", true],
    ["Liste", "- ", "", true],
    ["Liste numérotée", "1. ", "", true],
    ["Case à cocher", "- [ ] ", "", true],
    ["Lien", "[", "](https://)", false],
    ["Code", "`", "`", false],
    ["Bloc de code", "\n```\n", "\n```\n", false],
    ["Tableau", "\n| Colonne | Valeur |\n| --- | --- |\n| ", " |  |\n", false],
    ["Séparateur", "\n\n---\n", "", false],
  ] as const;
  return (
    <div
      className="markdown-format"
      role="toolbar"
      aria-label="Mise en forme Markdown"
    >
      {actions.map(([label, before, after, line]) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          onClick={() => insert(before, after, line)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function MarkdownEditor({
  name,
  value = "",
  label,
  required = false,
  maxLength = 12000,
  onChange,
}: {
  name?: string;
  value?: string;
  label: string;
  required?: boolean;
  maxLength?: number;
  onChange?: (v: string) => void;
}) {
  const id = useId(),
    ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value),
    [preview, setPreview] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const change = (v: string) => {
    setDraft(v);
    onChange?.(v);
  };
  return (
    <div className="markdown-editor">
      <label htmlFor={id}>{label}</label>
      <div className="markdown-tools">
        <div className="segmented">
          <button
            type="button"
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
          >
            Écrire
          </button>
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview(true)}
          >
            Aperçu
          </button>
        </div>
        {!preview && (
          <MarkdownToolbar value={draft} onChange={change} textareaRef={ref} />
        )}
      </div>
      <textarea
        ref={ref}
        id={id}
        name={name}
        value={draft}
        onChange={(e) => change(e.target.value)}
        required={required}
        maxLength={maxLength}
        rows={6}
        hidden={preview}
        onInvalid={() => setPreview(false)}
      />
      {preview &&
        (draft ? (
          <Markdown text={draft} />
        ) : (
          <p className="muted">Votre aperçu apparaîtra ici.</p>
        ))}
      <small className="muted">
        Markdown : titres, **gras**, ++souligné++, citations, listes, tableaux
        et code.
      </small>
    </div>
  );
}
