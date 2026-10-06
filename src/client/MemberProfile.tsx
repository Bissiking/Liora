// src/client/MemberProfile.tsx
import { Avatar, Modal } from "./ui";
import { EntityMenu, EntityMenuButton } from "./ContextMenuProvider";
import type { Row } from "./types";
import type { MenuAction } from "./ContextMenu";
export function MemberProfile({
  member,
  actions,
  close,
}: {
  member: Row;
  actions: MenuAction[];
  close: () => void;
}) {
  return (
    <Modal title="Profil" onClose={close} className="member-profile">
      <Avatar name={member.name} src={member.avatar} />
      <h2>{member.name}</h2>
      {member.username && <p>@{member.username}</p>}
      <p>
        {(
          {
            available: "Disponible",
            busy: "Occupé",
            away: "Absent",
            invisible: "Hors ligne",
          } as Record<string, string>
        )[member.status] || "Hors ligne"}
      </p>
      {member.role_name && <p className="profile-role">{member.role_name}</p>}
      {member.bio && <p>{member.bio}</p>}
      <div className="profile-actions">
        {actions
          .filter((a) => a.label !== "Voir le profil")
          .map((a) => (
            <button
              key={a.label}
              className={a.danger ? "danger" : ""}
              onClick={a.run}
            >
              {a.label}
            </button>
          ))}
      </div>
    </Modal>
  );
}
