// src/client/Preferences.tsx
import { useEffect, useState, type FormEvent } from "react";
import {
  UserRound,
  Palette,
  Bell,
  Shield,
  Monitor,
  LogOut,
  Save,
} from "lucide-react";
import { api, fileData } from "./api";
import type { User, Row, Result } from "./types";
import { ConnectedAccounts } from "./Integrations";
import { playSound } from "./sound";
import { deviceAppearance, saveDeviceAppearance } from "./theme-preference";
import { CalDavSettings } from "./CalDavSettings";
import { themes } from "../shared/themes";
import { HelpHint, preferenceHelp } from "./HelpHint";
import { GotifySettings } from "./GotifySettings";
import { PushSettings } from "./PushSettings";
export function Preferences({
  user,
  base,
  reload,
  fail,
}: {
  user: User;
  base: string;
  reload: () => Promise<void>;
  fail: (e: unknown) => void;
}) {
  const [tab, setTab] = useState(
      false
        ? "agenda"
        : location.hash.startsWith("#connected=dropit")
          ? "connections"
          : "profile",
    ),
    [sessions, setSessions] = useState<Row[]>([]),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false),
    [chosenTheme, setChosenTheme] = useState(deviceAppearance(user).theme);
  const [syncTheme, setSyncTheme] = useState(deviceAppearance(user).sync);
  useEffect(() => {
    if (location.hash.startsWith("#connected=dropit"))
      history.replaceState(null, "", location.pathname);
    api<Result>("/api/v1/sessions")
      .then((r) => setSessions(r.data))
      .catch(fail);
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    const d = new FormData(e.currentTarget),
      prefs = {
        theme: "dark",
        density: "comfortable",
        fontSize: "normal",
        mentions: true,
        argos: true,
        presence: true,
        enterToSend: true,
        timestamps: true,
        linkPreviews: false,
        sound: false,
        ...user.preferences,
      };
    for (const k of ["theme", "density", "fontSize", "dmPolicy", "soundVolume"])
      if (d.has(k) && (k !== "theme" || syncTheme))
        prefs[k as "theme"] = String(d.get(k));
    for (const k of [
      "mentions",
      "argos",
      "presence",
      "enterToSend",
      "timestamps",
      "messages",
      "directMessages",
      "tasks",
      "linkPreviews",
      "soundMessages",
      "soundMentions",
      "soundCritical",
    ])
      if (d.has(`present_${k}`)) prefs[k as "mentions"] = d.get(k) === "on";
    try {
      if (tab === "appearance")
        await api("/api/v1/me/appearance", "PATCH", {
          ...(syncTheme ? { theme: chosenTheme } : {}),
          density: prefs.density,
          fontSize: prefs.fontSize,
        });
      else
        await api("/api/v1/me", "PATCH", {
          name: d.get("name") || user.name,
          bio: d.get("bio") ?? user.bio,
          status: d.get("status") || user.status,
          preferences: prefs,
        });
      if (tab === "appearance")
        saveDeviceAppearance(user.id, syncTheme, chosenTheme);
      await reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }
  const sections = [
    ["profile", "Profil", UserRound],
    ["appearance", "Apparence", Palette],
    ["notifications", "Notifications", Bell],
    ["privacy", "Confidentialité et chat", Shield],
    ["sessions", "Sessions et appareils", Monitor],
    ["connections", "Comptes connectés", Monitor],
    ["agenda", "Synchronisation Agenda", Monitor],
    ["integrations", "Raccourcis personnels", Monitor],
  ] as const;
  return (
    <div className="settings-layout">
      <nav aria-label="Préférences">
        {sections.map(([key, label, Icon]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
        <button
          onClick={() =>
            void api("/auth/logout", "POST")
              .then(() => location.reload())
              .catch(fail)
          }
        >
          <LogOut size={17} />
          Se déconnecter
        </button>
      </nav>
      <section className="settings-panel">
        <h1>{sections.find((s) => s[0] === tab)?.[1]}</h1>
        <p className="muted">Vos réglages personnels, sur tous vos espaces.</p>
        <HelpHint title={preferenceHelp[tab]?.title || "Vos agendas"}>
          {preferenceHelp[tab]?.text ||
            "Ajoutez Liora à votre application de calendrier avec CalDAV."}
        </HelpHint>
        {tab === "agenda" ? (
          <CalDavSettings />
        ) : tab === "connections" ? (
          <ConnectedAccounts base={base} fail={fail} />
        ) : tab === "sessions" ? (
          <div>
            {sessions.map((s) => (
              <article className="session-row" key={s.id}>
                <Monitor size={20} />
                <div>
                  <strong>
                    {s.current ? "Cet appareil" : "Session active"}
                  </strong>
                  <p>{s.user_agent}</p>
                  <small>
                    Dernière activité :{" "}
                    {new Date(s.last_seen_at).toLocaleString("fr-FR")}
                  </small>
                </div>
                <button
                  onClick={() =>
                    void api(`/api/v1/sessions/${s.id}`, "DELETE")
                      .then(() =>
                        s.current
                          ? location.reload()
                          : setSessions((old) =>
                              old.filter((x) => x.id !== s.id),
                            ),
                      )
                      .catch(fail)
                  }
                >
                  Révoquer
                </button>
              </article>
            ))}
          </div>
        ) : (
          <form
            className="form"
            onSubmit={save}
            key={tab}
            onChange={() => setSaved(false)}
          >
            {tab === "profile" && (
              <>
                <label>
                  Avatar · image de 1 Mo maximum
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        await api("/api/v1/me/avatar", "POST", {
                          data: await fileData(f),
                        });
                        await reload();
                      } catch (e) {
                        fail(e);
                      }
                    }}
                  />
                </label>
                {user.avatar && (
                  <img
                    className="profile-avatar-preview"
                    src={user.avatar}
                    alt="Votre avatar"
                  />
                )}
                <label>
                  Pseudo
                  <input
                    name="name"
                    defaultValue={user.name}
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  Bio courte
                  <textarea
                    name="bio"
                    defaultValue={user.bio}
                    maxLength={300}
                    rows={3}
                  />
                </label>
                <label>
                  Statut
                  <select name="status" defaultValue={user.status}>
                    <option value="available">Disponible</option>
                    <option value="busy">Occupé</option>
                    <option value="away">Absent</option>
                    <option value="invisible">Invisible</option>
                  </select>
                </label>
                <p className="muted">
                  Identité Kyros : <code>{user.kyros_user_id}</code>
                </p>
              </>
            )}
            {tab === "appearance" && (
              <>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={syncTheme}
                    onChange={(e) => setSyncTheme(e.target.checked)}
                  />
                  Synchroniser le thème de mon compte sur cet appareil
                </label>
                <p className="muted">
                  {syncTheme
                    ? "Votre choix sera retrouvé à la connexion sur vos autres appareils synchronisés."
                    : "Ce choix reste dans ce navigateur. Le thème enregistré dans votre compte est conservé."}
                </p>
                <fieldset className="theme-gallery">
                  <legend>Choisissez votre univers</legend>
                  {themes.map((t) => (
                    <label
                      key={t.id}
                      className={`theme-choice ${chosenTheme === t.id ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={t.id}
                        checked={chosenTheme === t.id}
                        onChange={() => setChosenTheme(t.id)}
                      />
                      <span className="theme-preview" data-theme={t.id}>
                        <span className="theme-preview-nav" />
                        <span className="theme-preview-content">
                          <strong>Aa</strong>
                          <span />
                          <span />
                          <i />
                        </span>
                      </span>
                      <strong>{t.name}</strong>
                      <small>{t.description}</small>
                    </label>
                  ))}
                </fieldset>
                <label>
                  Densité
                  <select
                    name="density"
                    defaultValue={String(
                      user.preferences.density || "comfortable",
                    )}
                  >
                    <option value="comfortable">Confortable</option>
                    <option value="compact">Compacte</option>
                  </select>
                </label>
                <label>
                  Taille du texte
                  <select
                    name="fontSize"
                    defaultValue={String(user.preferences.fontSize || "normal")}
                  >
                    <option value="normal">Normale</option>
                    <option value="large">Grande</option>
                  </select>
                </label>
              </>
            )}
            {(tab === "notifications"
              ? [
                  ["mentions", "Mentions dans les conversations"],
                  ["argos", "Alertes Argos"],
                  ["messages", "Messages des salons suivis"],
                  ["directMessages", "Messages privés"],
                  ["tasks", "Tâches attribuées"],
                  ["soundMessages", "Son des nouveaux messages"],
                  ["soundMentions", "Son des mentions"],
                  ["soundCritical", "Son des alertes critiques"],
                ]
              : tab === "privacy"
                ? [
                    ["presence", "Partager ma présence"],
                    ["enterToSend", "Entrée pour envoyer un message"],
                    ["timestamps", "Afficher les heures des messages"],
                    ["linkPreviews", "Afficher les aperçus de liens"],
                  ]
                : []
            ).map(([key, label]) => (
              <label className="toggle-row" key={key}>
                <input type="hidden" name={`present_${key}`} value="1" />
                {label}
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={
                    key.startsWith("sound")
                      ? user.preferences[key] === true
                      : user.preferences[key] !== false
                  }
                />
              </label>
            ))}
            {tab === "privacy" && (
              <label>
                Qui peut m’envoyer des messages privés ?
                <select
                  name="dmPolicy"
                  defaultValue={String(user.preferences.dmPolicy || "members")}
                >
                  <option value="members">Tous les membres de l’espace</option>
                  <option value="friends">Mes amis uniquement</option>
                  <option value="nobody">Personne</option>
                </select>
              </label>
            )}
            {tab === "notifications" && (
              <>
                <PushSettings base={base} />
                <GotifySettings base={base} />
                <label>
                  Volume des sons
                  <select
                    name="soundVolume"
                    defaultValue={String(user.preferences.soundVolume || "low")}
                  >
                    <option value="low">Discret</option>
                    <option value="normal">Normal</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    void playSound(
                      "mention",
                      String(user.preferences.soundVolume || "low"),
                    ).catch(fail)
                  }
                >
                  Tester le son
                </button>
              </>
            )}
            {tab === "integrations" && <PersonalIntegrations fail={fail} />}
            <footer className="settings-save">
              <button className="primary" disabled={saving}>
                <Save size={16} />
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <p className="muted" role="status">
                {saved
                  ? "Préférences enregistrées sur votre compte."
                  : "Enregistrez pour appliquer vos modifications."}
              </p>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

function PersonalIntegrations({ fail }: { fail: (e: unknown) => void }) {
  const [rows, setRows] = useState<Row[]>([]),
    [name, setName] = useState(""),
    [url, setUrl] = useState("");
  const load = () =>
    void api<Result>("/api/v1/integrations")
      .then((r) => setRows(r.data))
      .catch(fail);
  useEffect(load, []);
  return (
    <section>
      <p>
        Vos raccourcis privés vers GitHub et vos services. Ils n’activent ni
        synchronisation ni accès OAuth.
      </p>
      <h3>Mes services</h3>
      {!rows.length && (
        <p className="muted">
          Gardez vos liens utiles ici. Ajoutez votre premier service ci-dessous.
        </p>
      )}
      {rows.map((r) => (
        <div className="integration-link" key={r.id}>
          <a href={r.url} target="_blank" rel="noopener noreferrer">
            <strong>{r.name}</strong>
            <small>{new URL(r.url).hostname}</small>
          </a>
          <button
            type="button"
            onClick={() =>
              void api(`/api/v1/integrations/${r.id}`, "DELETE")
                .then(load)
                .catch(fail)
            }
          >
            Retirer
          </button>
        </div>
      ))}
      <div className="personal-service-fields">
        <label>
          Nom du service
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="GitHub"
          />
        </label>
        <label>
          Adresse HTTPS
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/…"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!name || !url}
        onClick={() =>
          void api("/api/v1/integrations", "POST", { name, url })
            .then(() => {
              setName("");
              setUrl("");
              load();
            })
            .catch(fail)
        }
      >
        Ajouter le raccourci
      </button>
    </section>
  );
}
