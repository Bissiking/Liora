// src/client/PersonalHome.tsx
import { ArrowRight, Bell, StickyNote, Users, MapPin } from "lucide-react";
import type { User, Row } from "./types";
export function PersonalHome({
  user,
  notifications,
  navigate,
}: {
  user: User;
  notifications: Row[];
  navigate: (id: string) => void;
}) {
  const unread = notifications.filter((n) => n.state === "unread");
  return (
    <div className="page personal-home">
      <header className="page-heading">
        <div>
          <h1>Bonjour, {user.name}.</h1>
          <p>Vos notes, vos conversations et ce qui demande votre attention.</p>
        </div>
      </header>
      <section>
        <h2>Votre activité</h2>
        <button
          className="personal-activity"
          onClick={() => navigate("notifications")}
        >
          <Bell size={22} />
          <span>
            <strong>
              {unread.length
                ? `${unread.length} notification${unread.length > 1 ? "s" : ""} non lue${unread.length > 1 ? "s" : ""}`
                : "Vous êtes à jour"}
            </strong>
            <small>Boîte de réception de tous vos espaces</small>
          </span>
          <ArrowRight size={20} />
        </button>
      </section>
      <section>
        <h2>Retrouver l’essentiel</h2>
        <div className="personal-shortcuts">
          {[
            {
              id: "notes",
              title: "Notes datées",
              copy: "Vos idées et vos notes BrainDump",
              icon: StickyNote,
            },
            {
              id: "friends",
              title: "Amis et messages",
              copy: "Échanger dans votre espace personnel",
              icon: Users,
            },
            {
              id: "places",
              title: "Mes lieux",
              copy: "À essayer ou déjà visités",
              icon: MapPin,
            },
          ].map((item) => (
            <button key={item.id} onClick={() => navigate(item.id)}>
              <item.icon size={21} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.copy}</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      </section>
      <p className="muted">
        Les boutons du rail ouvrent vos workspaces. Vos données personnelles
        restent ici.
      </p>
    </div>
  );
}
