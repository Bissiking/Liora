// src/client/navigation.ts
import {
  House,
  MessageSquare,
  LayoutGrid,
  FileText,
  CalendarDays,
  Bell,
  Star,
  Users,
  Activity,
  Settings,
  CircleHelp,
  Shield,
  AlarmClock,
  MapPin,
} from "lucide-react";
export const navigation = [
  { id: "home", label: "Accueil", icon: House, group: "Mon espace" },
  {
    id: "notifications",
    label: "Boîte de réception",
    icon: Bell,
    group: "Mon espace",
  },
  { id: "reminders", label: "Rappels", icon: AlarmClock, group: "Mon espace" },
  { id: "places", label: "Mes lieux", icon: MapPin, group: "Mon espace" },
  { id: "favorites", label: "Favoris", icon: Star, group: "Mon espace" },
  {
    id: "chat",
    label: "Conversations",
    icon: MessageSquare,
    group: "Équipe",
    permission: "VIEW_CHANNEL",
  },
  {
    id: "projects",
    label: "Projets",
    icon: LayoutGrid,
    group: "Équipe",
    permission: "VIEW_PROJECT",
  },
  {
    id: "pages",
    label: "Pages de l'équipe",
    icon: FileText,
    group: "Équipe",
    permission: "VIEW_PAGES",
  },
  { id: "calendar", label: "Calendrier", icon: CalendarDays, group: "Équipe" },
  { id: "friends", label: "Amis", icon: Users, group: "Mon espace" },
  {
    id: "monitoring",
    label: "Supervision",
    icon: Activity,
    group: "Gestion",
    permission: "VIEW_MONITORING",
  },
  {
    id: "members",
    label: "Membres",
    icon: Users,
    group: "Gestion",
    permission: "MANAGE_MEMBERS",
  },
  {
    id: "admin",
    label: "Administration",
    icon: Shield,
    group: "Gestion",
    permission: "MANAGE_WORKSPACE",
  },
  { id: "settings", label: "Préférences", icon: Settings, group: "Réglages" },
  { id: "help", label: "Aide", icon: CircleHelp, group: "Réglages" },
];

export function navigationVisible(
  n: (typeof navigation)[number],
  can: (p: string) => boolean,
) {
  if (n.id === "admin")
    return [
      "MANAGE_WORKSPACE",
      "MANAGE_ROLES",
      "MANAGE_MEMBERS",
      "MANAGE_CHANNEL",
      "VIEW_AUDIT_LOG",
      "VIEW_BOTS",
      "VIEW_WEBHOOKS",
      "MANAGE_EMOJIS",
      "MANAGE_FEATURE_FLAGS",
    ].some(can);
  return !n.permission || can(n.permission);
}
