// src/shared/channel-permissions.ts
export const channelPermissions = {
  VIEW_CHANNEL: "Voir le canal",
  READ_MESSAGE: "Lire les messages",
  SEND_MESSAGE: "Écrire",
  ATTACH_FILES: "Ajouter des pièces jointes",
  ADD_REACTION: "Ajouter des réactions",
  CREATE_THREAD: "Créer des fils",
  REPLY_THREAD: "Répondre dans les fils",
  MENTION_USERS: "Mentionner",
  MANAGE_MESSAGES: "Gérer les messages",
  MANAGE_CHANNEL: "Gérer le canal",
  DELETE_CHANNEL: "Archiver le canal",
  EDIT_OWN_MESSAGE: "Modifier ses messages",
  DELETE_OWN_MESSAGE: "Supprimer ses messages",
} as const;
export type ChannelPermission = keyof typeof channelPermissions;
