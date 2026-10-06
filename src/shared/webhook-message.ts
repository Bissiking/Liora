// src/shared/webhook-message.ts
import { z } from "zod";
const url = z
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "URL HTTPS requise");
const metadata = z
  .record(z.string().max(100), z.unknown())
  .refine(
    (v) => JSON.stringify(v).length <= 8000,
    "Métadonnées trop volumineuses",
  )
  .default({});
export const embedSchema = z
  .object({
    title: z.string().max(256).optional(),
    description: z.string().max(4000).optional(),
    color: z
      .string()
      .regex(/^#[a-f0-9]{6}$/i)
      .optional(),
    url: url.optional(),
    author: z
      .object({
        name: z.string().max(100),
        url: url.optional(),
        icon: url.optional(),
      })
      .strict()
      .optional(),
    footer: z
      .object({ text: z.string().max(500), icon: url.optional() })
      .strict()
      .optional(),
    timestamp: z.iso.datetime({ offset: true }).optional(),
    fields: z
      .array(
        z
          .object({
            name: z.string().max(256),
            value: z.string().max(1000),
            inline: z.boolean().default(false),
          })
          .strict(),
      )
      .max(25)
      .default([]),
    image: url.optional(),
    thumbnail: url.optional(),
    icon: url.optional(),
    metadata,
  })
  .strict()
  .refine(
    (v) =>
      !!(v.title || v.description || v.fields.length || v.image || v.thumbnail),
    "Embed vide",
  )
  .refine((v) => JSON.stringify(v).length <= 12000, "Embed trop volumineux");
export const webhookMessageSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("TEXT"),
      content: z.string().trim().min(1).max(8000),
      metadata,
    })
    .strict(),
  z
    .object({
      mode: z.literal("EMBED"),
      content: z.string().max(8000).optional(),
      embed: embedSchema,
      metadata,
    })
    .strict(),
]);
export type WebhookMessage = z.infer<typeof webhookMessageSchema>;
export type WebhookEmbed = z.infer<typeof embedSchema>;
export function webhookText(message: WebhookMessage) {
  return message.mode === "TEXT"
    ? message.content
    : message.content ||
        [
          message.embed.title,
          message.embed.description,
          ...message.embed.fields.map((f) => `${f.name}: ${f.value}`),
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 8000) ||
        "Message enrichi";
}
