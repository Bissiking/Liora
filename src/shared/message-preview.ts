// src/shared/message-preview.ts
type Mention = { id: string; name: string; kyros_user_id?: string };

export function displayMentions(text: string, members: Mention[]) {
  return text.replace(
    /@\[([0-9a-f-]{36})\]/gi,
    (_, id: string) =>
      `@${members.find((m) => m.id.toLowerCase() === id.toLowerCase() || m.kyros_user_id?.toLowerCase() === id.toLowerCase())?.name || "membre"}`,
  );
}

export function messageExcerpt(
  text: string,
  members: Mention[] = [],
  limit = 90,
) {
  return displayMentions(text, members)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(^|\n)\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/g, "$1")
    .replace(/(?:\*\*|__|~~|\+\+|`|\*)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}
