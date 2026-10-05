// src/client/main.tsx
import { VERSION } from "../shared/version";
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Hash,
  Lock,
  ChevronDown,
  Plus,
  MessageSquare,
  LayoutGrid,
  FileText,
  Activity,
  Bell,
  Settings,
  PanelLeft,
  ArrowRight,
  LogOut,
  Search,
  Command,
  Users,
  ArrowUpRight,
  Star,
  Calendar as CalendarIcon,
  UserPlus,
  Shield,
  House,
  Menu,
  X,
} from "lucide-react";
import "@fontsource-variable/manrope";
import "./styles.css";
import "./ux.css";
import "./themes/index.css";
import "./release-050.css";
import "./release-060.css";
import "./release-070.css";
import { deviceAppearance } from "./theme-preference";
import { navigation, navigationVisible } from "./navigation";
import { Home } from "./Home";
import { QuickSwitch } from "./QuickSwitch";
import { Inbox } from "./Inbox";
import { api, ApiError, collection } from "./api";
import type { Row, Result, User, Workspace } from "./types";
import { Avatar, Empty, FormDialog, type Field } from "./ui";
import { Chat } from "./Chat";
import { Projects } from "./Projects";
import { Pages } from "./Pages";
import { Admin } from "./Admin";
import { Preferences } from "./Preferences";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { RenderBoundary } from "./RenderBoundary";
import { Monitoring } from "./Monitoring";
import { SearchMessages } from "./Collaboration";
import { Notes } from "./Notes";
import { Friends, Invitation } from "./Social";
import { Help } from "./Help";
import { Calendar } from "./Calendar";
import { Reminders } from "./Reminders";
import { Favorites } from "./Favorites";
import { Groups } from "./Groups";
import { Members } from "./Members";
import { playSound } from "./sound";
import { applyPwaUpdate } from "./pwa";
const Places = lazy(() =>
  import("./Places").then((m) => ({ default: m.Places })),
);
function App() {
  const [collapsedNavigation, setCollapsedNavigation] = useState<string[]>([]),
    [collapsingNavigation, setCollapsingNavigation] = useState(false);
  const [pwaUpdate, setPwaUpdate] = useState(false);
  useEffect(() => {
    const ready = () => setPwaUpdate(true);
    window.addEventListener("liora:update-ready", ready);
    void navigator.serviceWorker?.getRegistration().then((r) => {
      if (r?.waiting) setPwaUpdate(true);
    });
    return () => window.removeEventListener("liora:update-ready", ready);
  }, []);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const [invite, setInvite] = useState(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get("invite");
    if (token) sessionStorage.setItem("liora.invite", token);
    return token || sessionStorage.getItem("liora.invite") || "";
  });
  useEffect(() => {
    const receive = () => {
      const token = new URLSearchParams(location.hash.slice(1)).get("invite");
      if (token) {
        sessionStorage.setItem("liora.invite", token);
        setInvite(token);
      }
    };
    window.addEventListener("hashchange", receive);
    return () => window.removeEventListener("hashchange", receive);
  }, []);
  const [targetResource, setTargetResource] = useState<Row | null>(null);
  const [targetMessage, setTargetMessage] = useState("");
  const seenNotifications = useRef<Set<string> | null>(null);
  const [searchMessages, setSearchMessages] = useState(false);
  const [quickSwitch, setQuickSwitch] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [me, setMe] = useState<User | null>(null),
    [spaces, setSpaces] = useState<Workspace[]>([]),
    [workspaceId, setWorkspaceId] = useState(""),
    [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [view, setView] = useState(
      () => sessionStorage.getItem("liora.view") || "home",
    ),
    [adminTab, setAdminTab] = useState(
      () => sessionStorage.getItem("liora.adminTab") || "overview",
    ),
    [channels, setChannels] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [channelId, setChannelId] = useState(
      () => sessionStorage.getItem("liora.channel") || "",
    ),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(""),
    [revision, setRevision] = useState(0),
    [connection, setConnection] = useState("Connexion…"),
    [presence, setPresence] = useState<Row[]>([]),
    [notifications, setNotifications] = useState<Row[]>([]),
    [form, setForm] = useState<{
      title: string;
      fields: Field[];
      save: (data: Record<string, string>) => Promise<void>;
    } | null>(null);
  useEffect(() => {
    if (!mobile && !channelsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        setChannelsOpen(false);
        menuTrigger.current?.focus();
      }
      if (e.key === "Tab" && !document.querySelector("dialog[open]")) {
        const controls = Array.from(
          (mobile
            ? sidebarRef.current
            : document.querySelector(".conversation-index")
          )?.querySelectorAll<HTMLElement>("button:not(:disabled),input") || [],
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    (mobile
      ? sidebarRef.current
      : document.querySelector(".conversation-index")
    )
      ?.querySelector<HTMLElement>("button")
      ?.focus();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobile, channelsOpen]);
  useEffect(() => {
    setCollapsedNavigation(
      Array.isArray(me?.preferences.collapsedNavigation)
        ? (me.preferences.collapsedNavigation as string[])
        : [],
    );
  }, [me]);
  const collapse = async (key: string) => {
    if (!me || collapsingNavigation) return;
    setCollapsingNavigation(true);
    const next = collapsedNavigation.includes(key)
      ? collapsedNavigation.filter((k) => k !== key)
      : [...collapsedNavigation, key];
    setCollapsedNavigation(next);
    try {
      await api("/api/v1/me/navigation", "PATCH", {
        collapsedNavigation: next,
      });
      setMe((current) =>
        current
          ? {
              ...current,
              preferences: {
                ...current.preferences,
                collapsedNavigation: next,
              },
            }
          : current,
      );
    } catch (e) {
      setCollapsedNavigation(collapsedNavigation);
      fail(e);
    } finally {
      setCollapsingNavigation(false);
    }
  };
  const workspace = spaces.find((w) => w.id === workspaceId),
    base = `/api/v1/workspaces/${workspaceId}`,
    can = (p: string) => workspace?.permissions.includes(p) || false;
  useEffect(() => {
    const open = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      const id = params.get("workspace");
      const destination = spaces.find((w) => w.id === id);
      if (params.get("view") === "notifications" && destination) {
        setWorkspaceId(id!);
        setView("notifications");
        history.replaceState(null, "", location.pathname);
      } else if (
        params.get("view") === "projects" &&
        destination?.permissions.includes("VIEW_PROJECT")
      ) {
        setWorkspaceId(id!);
        setView("projects");
        const task = params.get("task"),
          project = params.get("project"),
          valid = (v: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);
        setTargetResource(
          valid(task) && destination.permissions.includes("VIEW_BOARD")
            ? ({ target_type: "task", target_id: task } as Row)
            : valid(project)
              ? ({ target_type: "project", target_id: project } as Row)
              : null,
        );
        history.replaceState(null, "", location.pathname);
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [spaces]);
  const refresh = () => setRevision((n) => n + 1);
  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : "Connexion interrompue.");
  const loadMe = useCallback(async () => {
    if (location.hash.startsWith("#google-calendar=")) setView("settings");
    try {
      const r = await api<{ data: User; workspaces: Workspace[] }>(
        "/api/v1/me",
      );
      setMe(r.data);
      setSpaces(r.workspaces);
      setWorkspaceId((old) =>
        r.workspaces.some((w) => w.id === old)
          ? old
          : r.workspaces[0]?.id || "",
      );
      setStatus("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setStatus("login");
      else {
        fail(e);
        setStatus((old) => (old === "ready" ? "ready" : "error"));
      }
    }
  }, []);
  useEffect(() => {
    void loadMe();
  }, [loadMe]);
  useEffect(() => {
    if (channelId) sessionStorage.setItem("liora.channel", channelId);
  }, [channelId]);
  useEffect(() => {
    sessionStorage.setItem("liora.view", view);
  }, [view]);
  useEffect(() => {
    sessionStorage.setItem("liora.adminTab", adminTab);
  }, [adminTab]);
  useEffect(() => {
    if (!me) return;
    const prefs = me.preferences;
    const applyTheme = () => {
      document.documentElement.dataset.theme = deviceAppearance(me).theme;
    };
    applyTheme();
    window.addEventListener("storage", applyTheme);
    window.addEventListener("liora:appearance", applyTheme);
    document.documentElement.dataset.density = String(
      prefs.density || "comfortable",
    );
    document.documentElement.dataset.fontSize = String(
      prefs.fontSize || "normal",
    );
    return () => {
      window.removeEventListener("storage", applyTheme);
      window.removeEventListener("liora:appearance", applyTheme);
    };
  }, [me]);
  useEffect(() => {
    if (!me) return;
    let running = false;
    const renew = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      try {
        await api("/auth/refresh", "POST");
        await loadMe();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setStatus("login");
      } finally {
        running = false;
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void renew();
    };
    const timer = setInterval(renew, 60000);
    window.addEventListener("online", renew);
    window.addEventListener("pageshow", renew);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", renew);
      window.removeEventListener("pageshow", renew);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [me]);
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    Promise.all([
      can("VIEW_CHANNEL") ? collection(`${base}/channels`) : { data: [] },
      can("VIEW_CHANNEL") ? collection(`${base}/categories`) : { data: [] },
      api<Result>(`${base}/notifications`),
      api<Result>(`${base}/presence`),
    ])
      .then(([c, g, n, p]) => {
        if (cancelled) return;
        setChannels(c.data);
        setCategories(g.data);
        setNotifications(n.data);
        if (seenNotifications.current) {
          const fresh = n.data.find(
            (n) =>
              n.state === "unread" && !seenNotifications.current!.has(n.id),
          );
          if (fresh) {
            const kind =
              fresh.type === "argos"
                ? "critical"
                : fresh.type === "mention"
                  ? "mention"
                  : "message";
            const pref =
              kind === "critical"
                ? "soundCritical"
                : kind === "mention"
                  ? "soundMentions"
                  : "soundMessages";
            if (me?.preferences[pref])
              void playSound(
                kind,
                String(me.preferences.soundVolume || "low"),
              ).catch(() => {});
          }
        }
        seenNotifications.current = new Set(n.data.map((n) => n.id));
        setPresence(p.data);
        setChannelId((old) =>
          c.data.some((ch) => ch.id === old)
            ? old
            : c.data.find((ch) => !ch.archived)?.id || "",
        );
      })
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [workspaceId, revision, workspace?.permissions.join(",")]);
  useEffect(() => {
    if (!workspaceId) return;
    const stream = new EventSource(`${base}/stream`);
    stream.onopen = () => {
      setConnection("En direct");
      refresh();
    };
    stream.onmessage = (event) => {
      refresh();
      if (JSON.parse(event.data).type === "access.updated") void loadMe();
    };
    stream.onerror = () => setConnection("Reconnexion…");
    return () => stream.close();
  }, [workspaceId]);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") setMobile(false);
      if (e.repeat || e.altKey || document.querySelector("dialog[open]"))
        return;
      if (
        mod &&
        e.shiftKey &&
        e.key.toLowerCase() === "f" &&
        can("VIEW_CHANNEL")
      ) {
        e.preventDefault();
        setSearchMessages(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickSwitch(true);
        return;
      }
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      const routes: Record<string, string> = {
        "0": "home",
        "1": "chat",
        "2": "projects",
        "3": "calendar",
        "4": "reminders",
        "5": "favorites",
        "6": "notifications",
        "7": "pages",
        ",": "settings",
        "/": "help",
      };
      const route = routes[e.key];
      if (
        mod &&
        route &&
        !(route === "projects" && !can("VIEW_PROJECT")) &&
        !(route === "pages" && !can("VIEW_PAGES"))
      ) {
        e.preventDefault();
        navigate(route);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [workspace?.permissions]);
  useEffect(() => {
    if (
      workspace &&
      view === "monitoring" &&
      !workspace.permissions.includes("VIEW_MONITORING")
    )
      setView("home");
  }, [workspace, view]);
  useEffect(() => {
    if (
      location.hash.startsWith("#connected=dropit") ||
      location.hash.startsWith("#connected=braindump")
    ) {
      const linkedWorkspace = new URLSearchParams(location.hash.slice(1)).get(
        "workspace",
      );
      if (linkedWorkspace) setWorkspaceId(linkedWorkspace);
      setView(
        location.hash.startsWith("#connected=braindump") ? "notes" : "settings",
      );
    }
  }, []);
  useEffect(() => {
    const open = () => {
      if (location.hash.startsWith("#connected=braindump")) setView("notes");
    };
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  const navigate = (v: string) => {
    setTargetResource(null);
    setView(v);
    setMobile(false);
    setChannelsOpen(false);
    requestAnimationFrame(() => {
      if (
        !document.querySelector("dialog[open]") &&
        !document.activeElement?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        document.getElementById("main")?.focus({ preventScroll: true });
    });
  };
  const openChannel = (id: string) => {
    setChannelId(id);
    navigate("chat");
  };
  const openResource = (row: Row) => {
    if (row.target_type === "channel" || row.target_type === "message") {
      setChannelId(
        row.target_type === "channel" ? row.target_id : row.channel_id,
      );
      setTargetMessage(row.target_type === "message" ? row.target_id : "");
      navigate("chat");
    } else {
      const route = (
        {
          page: "pages",
          project: "projects",
          task: "projects",
          event: "calendar",
        } as Record<string, string>
      )[row.target_type];
      if (!route) return;
      navigate(route);
    }
    setTargetResource(row);
  };
  const createConversation = () =>
    void collection(`${base}/members`)
      .then((r) =>
        setForm({
          title: "Nouvelle conversation privée",
          fields: [
            {
              key: "user_id",
              label: "Membre",
              options: r.data
                .filter((m) => m.id !== me?.id)
                .map((m) => ({ value: m.id, label: m.name })),
            },
          ],
          save: async (d) => {
            const r = await api<{ data: Row }>(
              `${base}/conversations`,
              "POST",
              d,
            );
            refresh();
            openChannel(r.data.id);
          },
        }),
      )
      .catch(fail);
  const createChannel = () =>
    setForm({
      title: "Créer un salon",
      fields: [
        { key: "name", label: "Nom du salon" },
        { key: "description", label: "Description", required: false },
        {
          key: "is_private",
          label: "Visibilité",
          options: [
            { value: "false", label: "Tous les membres" },
            { value: "true", label: "Privé · accès sur invitation" },
          ],
        },
        {
          key: "category_id",
          label: "Catégorie",
          required: false,
          options: [
            { value: "", label: "Sans catégorie" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ],
        },
        {
          key: "type",
          label: "Type",
          options: [
            { value: "text", label: "Discussion" },
            { value: "announcement", label: "Annonces" },
            { value: "project", label: "Projet" },
            ...(can("MANAGE_MONITORING")
              ? [{ value: "monitoring", label: "Monitoring" }]
              : []),
          ],
        },
      ],
      save: async (d) => {
        const r = await api<{ data: Row }>(`${base}/channels`, "POST", {
          ...d,
          category_id: d.category_id || null,
          is_private: d.is_private === "true",
        });
        refresh();
        setChannelId(r.data.id);
        navigate("chat");
      },
    });
  if (status === "loading")
    return (
      <div className="loading">
        <img src="/brand/icon.svg" alt="" />
        <p>Ouverture de Liora…</p>
      </div>
    );
  if (status === "login" || status === "error")
    return (
      <div className="login">
        <div className="login-brand">
          <img src="/brand/logo-dark.svg" alt="Liora" />
          <span>Un espace LUMA</span>
        </div>
        <main>
          <h1>
            Retrouvez votre équipe.
            <br />
            <em>Faites avancer la suite.</em>
          </h1>
          <p>
            Discutez, organisez vos projets et gardez vos rendez-vous en vue.
            Votre espace de travail LUMA vous attend.
          </p>
          <a className="primary" href="/auth/login">
            Entrer avec Kyros
            <ArrowRight size={18} />
          </a>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <small>Votre identité Kyros. Les permissions de votre équipe.</small>
        </main>
        <footer>
          <span>Liora {VERSION} · BETA</span>
          <span>Communication. Organisation. Connexion.</span>
        </footer>
      </div>
    );
  if (invite && me)
    return (
      <Invitation
        token={invite}
        done={async () => {
          sessionStorage.removeItem("liora.invite");

          setInvite("");
          await loadMe();
        }}
      />
    );
  if (!workspace)
    return (
      <div className="personal-shell">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <nav aria-label="Mon espace personnel" className="personal-nav">
          <button onClick={() => navigate("home")}>Bienvenue</button>
          <button onClick={() => navigate("places")}>Mes lieux</button>
          <button onClick={() => navigate("friends")}>Amis</button>
          <button onClick={() => navigate("notes")}>Notes datées</button>
          <button onClick={() => navigate("settings")}>Préférences</button>
          <button onClick={() => navigate("help")}>Aide</button>
        </nav>
        {view === "places" ? (
          <Suspense fallback={<p>Chargement de la carte…</p>}>
            <Places />
          </Suspense>
        ) : view === "notes" ? (
          <Notes />
        ) : view === "friends" ? (
          <Friends
            userId={me!.id}
            workspace=""
            revision={revision}
            fail={fail}
          />
        ) : view === "settings" ? (
          <Preferences user={me!} base="" reload={loadMe} fail={fail} />
        ) : view === "help" ? (
          <Help />
        ) : (
          <div className="waiting">
            <div className="waiting-header">
              <img src="/brand/logo-dark.svg" alt="Liora" />
              <h1>Bienvenue, {me?.name}.</h1>
              <p>
                Connectez-vous avec votre équipe. Créez un espace ou acceptez
                une invitation pour commencer.
              </p>
            </div>

            <div className="waiting-cards">
              <section className="waiting-card">
                <h2>Accepter une invitation</h2>
                <p>
                  Vous avez reçu un lien d'amis ? Collez-le ici pour accepter.
                </p>
                <div className="waiting-join">
                  <input
                    aria-label="Lien d'invitation"
                    placeholder="Lien d'invitation"
                    id="join-input"
                  />
                  <button
                    className="primary"
                    onClick={() => {
                      const input = document.getElementById(
                        "join-input",
                      ) as HTMLInputElement;
                      const val = input?.value?.trim();
                      if (!val) return;
                      let token = val;
                      if (val.includes("#invite=")) {
                        token = val.split("#invite=")[1] || "";
                      } else if (val.includes("/invite/")) {
                        token = val.split("/invite/")[1] || "";
                      }
                      if (token) {
                        location.hash = `invite=${token}`;
                        location.reload();
                      }
                    }}
                  >
                    Accepter
                  </button>
                </div>
              </section>

              <section className="waiting-card">
                <h2>Créer un espace</h2>
                <p>
                  Invitez vos amis et commencez à discuter dans votre propre
                  espace.
                </p>
                <button
                  onClick={() =>
                    setForm({
                      title: "Nouvel espace",
                      fields: [{ key: "name", label: "Nom de l'espace" }],
                      save: async (d) => {
                        await api("/api/v1/workspaces", "POST", d);
                        await loadMe();
                      },
                    })
                  }
                >
                  Créer mon espace
                </button>
              </section>
            </div>

            <section className="waiting-account">
              <h2>Votre identifiant</h2>
              <p>
                Partagez cet identifiant avec quelqu'un pour qu'il puisse vous
                envoyer une demande d'amis.
              </p>
              <code className="waiting-kyros">{me?.kyros_user_id}</code>
              <div className="waiting-actions">
                <button onClick={() => void loadMe()}>Actualiser</button>
                <button
                  onClick={() =>
                    void api("/auth/logout", "POST").then(() =>
                      location.reload(),
                    )
                  }
                >
                  Se déconnecter
                </button>
              </div>
            </section>

            {form && (
              <FormDialog
                title={form.title}
                fields={form.fields}
                onSave={form.save}
                onClose={() => setForm(null)}
              />
            )}
          </div>
        )}
      </div>
    );
  const channel = channels.find(
      (c) =>
        c.id === channelId &&
        (c.type !== "monitoring" || can("VIEW_MONITORING")),
    ),
    unread = notifications.filter((n) => n.state === "unread").length;
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Aller au contenu
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setMobile(false)}
        />
      )}
      {searchMessages && (
        <SearchMessages
          base={base}
          close={() => setSearchMessages(false)}
          open={(id, message) => {
            setTargetMessage(message);
            setChannelId(id);
            navigate("chat");
          }}
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar ${mobile ? "open" : ""}`}
        aria-label="Navigation de l’espace"
      >
        <div className="sidebar-brand">
          <button onClick={() => navigate("home")} aria-label="Accueil Liora">
            <img src="/brand/icon.svg" alt="" />
            <strong>Liora</strong>
            <span>BETA</span>
          </button>
          <button
            className="icon-button sidebar-close"
            aria-label="Fermer le menu"
            onClick={() => {
              setMobile(false);
              menuTrigger.current?.focus();
            }}
          >
            <X size={20} />
          </button>
        </div>
        <WorkspaceMenu
          workspace={workspace}
          spaces={spaces}
          select={(id) => {
            setWorkspaceId(id);
            setChannelId("");
            setView("home");
            setMobile(false);
          }}
          create={() =>
            setForm({
              title: "Créer un espace",
              fields: [{ key: "name", label: "Nom de l'espace" }],
              save: async (d) => {
                const r = await api<{ data: Workspace }>(
                  "/api/v1/workspaces",
                  "POST",
                  d,
                );
                await loadMe();
                setWorkspaceId(r.data.id);
                setView("home");
              },
            })
          }
          admin={(tab) => {
            setAdminTab(tab);
            navigate("admin");
          }}
        />
        <button
          className="navigation-search"
          onClick={() => setQuickSwitch(true)}
        >
          <Search size={17} />
          <span>Aller à…</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="navigation-scroll">
          {["Mon espace", "Équipe", "Gestion", "Réglages"].map((group) => {
            const items = navigation.filter(
              (n) => n.group === group && navigationVisible(n, can),
            );
            return items.length ? (
              <nav className="nav-group" key={group} aria-label={group}>
                <h2>
                  <button
                    className="nav-collapse"
                    aria-expanded={!collapsedNavigation.includes(group)}
                    aria-controls={`nav-${group.replaceAll(" ", "-")}`}
                    onClick={() => void collapse(group)}
                  >
                    <span>{group}</span>
                    <ChevronDown size={14} />
                  </button>
                </h2>
                <div
                  id={`nav-${group.replaceAll(" ", "-")}`}
                  hidden={collapsedNavigation.includes(group)}
                >
                  {items.map((n) => (
                    <button
                      key={n.id}
                      aria-label={n.label}
                      className={view === n.id ? "active" : ""}
                      aria-current={view === n.id ? "page" : undefined}
                      onClick={() => navigate(n.id)}
                    >
                      <n.icon size={18} />
                      <span>{n.label}</span>
                      {n.id === "notifications" && unread > 0 && (
                        <span className="count">{unread}</span>
                      )}
                    </button>
                  ))}
                </div>
              </nav>
            ) : null;
          })}
        </div>
        <div className="sidebar-bottom">
          <div className="version-note">
            <img src="/brand/icon.svg" alt="" />
            <span>
              Liora <small>{VERSION} · BETA</small>
            </span>
            <button
              className="icon-button"
              aria-label="À propos de Liora"
              onClick={() => navigate("about")}
            >
              <ArrowUpRight size={16} />
            </button>
          </div>
          <button
            className="profile-button"
            onClick={() => navigate("settings")}
          >
            <Avatar src={me!.avatar} name={me!.name} small />
            <span>
              <strong>{me!.name}</strong>
              <small>{workspace.role_name}</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-button menu-toggle"
            ref={menuTrigger}
            aria-label="Ouvrir la navigation"
            aria-expanded={mobile}
            aria-controls="workspace-navigation"
            onClick={() => setMobile(!mobile)}
          >
            <PanelLeft />
          </button>
          <div className="breadcrumb">
            <span>{workspace.name}</span>
            <span>/</span>
            <strong>
              {view === "chat"
                ? channel?.name || "Conversations"
                : (
                    {
                      home: "Accueil",
                      notes: "Notes datées",
                      friends: "Amis",
                      help: "Aide et tutoriels",
                      projects: "Projets",
                      calendar: "Calendrier",
                      reminders: "Rappels",
                      favorites: "Favoris",
                      pages: "Pages de l'équipe",
                      monitoring: "Supervision",
                      members: "Membres",
                      notifications: "Boîte de réception",
                      places: "Mes lieux",
                      admin: "Administration",
                      settings: "Préférences",
                      about: "À propos",
                    } as Record<string, string>
                  )[view]}
            </strong>
          </div>
          <div className="topbar-right">
            {view === "chat" && (
              <button
                className="channel-picker"
                onClick={() => setChannelsOpen(true)}
                aria-expanded={channelsOpen}
              >
                <Hash size={17} /> Salons
              </button>
            )}
            <button
              className="icon-button topbar-search"
              aria-label="Rechercher des messages"
              onClick={() => setSearchMessages(true)}
            >
              <Search size={16} />
            </button>
            <span
              className={`connection ${connection === "En direct" ? "online" : ""}`}
            >
              <i />
              {connection}
            </span>
            <span className="divider" />
            <span
              className="presence-indicator"
              title="Membres actifs dans l’espace"
            >
              <Users size={16} /> {presence.length} en ligne
            </span>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => setError("")}>Fermer</button>
          </div>
        )}
        <main id="main" tabIndex={-1} className={`content content-${view}`}>
          {view === "chat" && (
            <>
              {channelsOpen && (
                <button
                  className="channels-backdrop"
                  aria-label="Fermer le panneau des salons"
                  onClick={() => setChannelsOpen(false)}
                />
              )}
              <aside
                className={`channel-index conversation-index ${channelsOpen ? "open" : ""}`}
                aria-label="Salons et conversations"
              >
                <header className="conversation-index-heading">
                  <h2>Conversations</h2>
                  <button
                    className="icon-button conversation-close"
                    aria-label="Fermer les salons"
                    onClick={() => setChannelsOpen(false)}
                  >
                    <X size={20} />
                  </button>
                </header>
                {can("SEND_MESSAGE") && (
                  <button
                    className="new-conversation"
                    onClick={createConversation}
                  >
                    <Plus size={16} /> Conversation privée
                  </button>
                )}
                <div className="channel-filter">
                  <Search size={13} />
                  <input
                    id="channel-search"
                    aria-label="Filtrer les salons"
                    placeholder="Trouver un salon…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="section-label">
                  <span>Salons de l’espace</span>
                  {can("CREATE_CHANNEL") && (
                    <button
                      className="icon-button"
                      aria-label="Créer un salon"
                      onClick={createChannel}
                    >
                      <Plus size={15} />
                    </button>
                  )}
                </div>
                {[...categories, { id: "", name: "SANS CATÉGORIE" } as Row].map(
                  (cat) => {
                    const items = channels.filter(
                      (c) =>
                        (c.type !== "monitoring" || can("VIEW_MONITORING")) &&
                        !c.archived &&
                        (c.category_id || "") === cat.id &&
                        c.name.toLowerCase().includes(query.toLowerCase()),
                    );
                    return items.length ? (
                      <section className="channel-group" key={cat.id}>
                        <h3>
                          <button
                            className="nav-collapse"
                            aria-expanded={
                              !!query ||
                              !collapsedNavigation.includes(
                                `channel:${workspaceId}:${cat.id}`,
                              )
                            }
                            aria-controls={`channels-${cat.id || "other"}`}
                            onClick={() =>
                              void collapse(`channel:${workspaceId}:${cat.id}`)
                            }
                          >
                            <span>{cat.name}</span>
                            <ChevronDown size={12} />
                          </button>
                        </h3>
                        <div
                          id={`channels-${cat.id || "other"}`}
                          hidden={
                            !query &&
                            collapsedNavigation.includes(
                              `channel:${workspaceId}:${cat.id}`,
                            )
                          }
                        >
                          {items.map((c) => (
                            <button
                              key={c.id}
                              className={
                                view === "chat" && channelId === c.id
                                  ? "active"
                                  : ""
                              }
                              onClick={() => {
                                setChannelId(c.id);
                                navigate("chat");
                              }}
                            >
                              {c.is_private ? (
                                <Lock size={16} />
                              ) : c.type === "monitoring" ? (
                                <Activity size={17} />
                              ) : (
                                <Hash size={17} />
                              )}
                              <span>{c.name}</span>
                              {view === "chat" && channelId === c.id && (
                                <span className="active-dot" />
                              )}
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null;
                  },
                )}
                {query &&
                  !channels.some(
                    (c) =>
                      !c.archived &&
                      (c.type !== "monitoring" || can("VIEW_MONITORING")) &&
                      c.name.toLowerCase().includes(query.toLowerCase()),
                  ) && (
                    <p className="muted padded">
                      Aucun salon ne correspond à « {query} ».
                    </p>
                  )}
                {!channels.length && (
                  <p className="muted padded">Créez votre premier salon.</p>
                )}
              </aside>
            </>
          )}

          <RenderBoundary key={`${workspaceId}/${view}`}>
            {view === "home" && (
              <Home
                base={base}
                user={me!}
                workspace={workspace}
                channels={channels}
                notifications={notifications}
                revision={revision}
                navigate={navigate}
                openChannel={openChannel}
                openResource={openResource}
              />
            )}

            {view === "chat" &&
              (channel ? (
                <Chat
                  key={`${base}/${channel.id}`}
                  base={base}
                  channel={channel}
                  targetMessage={targetMessage}
                  clearTarget={() => setTargetMessage("")}
                  user={me!}
                  can={can}
                  revision={revision}
                  refresh={refresh}
                  fail={fail}
                  presence={presence}
                />
              ) : (
                <Empty
                  title="Un espace pour les conversations"
                  action={
                    can("CREATE_CHANNEL") ? (
                      <button className="primary" onClick={createChannel}>
                        Créer un salon
                      </button>
                    ) : undefined
                  }
                >
                  Les salons de votre équipe apparaîtront ici.
                </Empty>
              ))}
            {view === "projects" && (
              <Projects
                initialProject={
                  targetResource?.target_type === "project"
                    ? targetResource.target_id
                    : ""
                }
                initialTask={
                  targetResource?.target_type === "task"
                    ? targetResource.target_id
                    : ""
                }
                base={base}
                can={can}
                revision={revision}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "pages" && (
              <Pages
                initialPage={
                  targetResource?.target_type === "page"
                    ? targetResource.target_id
                    : ""
                }
                base={base}
                can={can}
                revision={revision}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "calendar" && (
              <Calendar
                initialEvent={
                  targetResource?.target_type === "event"
                    ? targetResource.target_id
                    : ""
                }
                userId={me!.id}
                base={base}
                can={can}
                revision={revision}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "reminders" && (
              <Reminders
                base={base}
                revision={revision}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "favorites" && (
              <Favorites
                base={base}
                revision={revision}
                onNavigate={openResource}
                fail={fail}
              />
            )}
            {view === "members" && can("MANAGE_MEMBERS") && (
              <Members base={base} can={can} fail={fail} refresh={refresh} />
            )}
            {view === "notes" && <Notes />}
            {view === "friends" && (
              <Friends
                userId={me!.id}
                workspace={workspaceId}
                revision={revision}
                fail={fail}
              />
            )}
            {view === "places" && (
              <Suspense fallback={<p role="status">Chargement de la carte…</p>}>
                <Places />
              </Suspense>
            )}
            {view === "help" && <Help />}
            {view === "monitoring" && can("VIEW_MONITORING") && (
              <Monitoring
                key={base}
                base={base}
                revision={revision}
                fail={fail}
              />
            )}
            {view === "admin" && (
              <Admin
                key={`${workspaceId}/${adminTab}`}
                initialTab={adminTab}
                base={base}
                workspace={workspace}
                can={can}
                refresh={() => {
                  refresh();
                  void loadMe();
                }}
                fail={fail}
              />
            )}
            {view === "settings" && (
              <Preferences
                base={base}
                user={me!}
                reload={async () => {
                  await loadMe();
                  refresh();
                }}
                fail={fail}
              />
            )}
            {view === "notifications" && (
              <Inbox
                openChannel={openChannel}
                base={base}
                notifications={notifications}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "about" && (
              <div className="page about">
                <img src="/brand/logo-dark.svg" alt="Liora" />
                <h1>
                  Un point de rencontre.
                  <br />
                  De nouvelles possibilités.
                </h1>
                <p>
                  Liora rassemble les conversations, les projets et les signaux
                  de l’écosystème LUMA.
                </p>
                <dl>
                  <dt>Version</dt>
                  <dd>{VERSION} — BETA</dd>
                  <dt>Authentification</dt>
                  <dd>Kyros SSO v4 · renouvellement automatique</dd>
                  <dt>Espace actuel</dt>
                  <dd>{workspace.name}</dd>
                </dl>
                <p className="muted">
                  Les fonctionnalités média sont différées. Les données du seed
                  sont identifiées comme démonstration.
                </p>
              </div>
            )}
          </RenderBoundary>
        </main>
      </div>
      <nav className="mobile-dock" aria-label="Navigation mobile">
        {[
          navigation[0],
          ...(can("VIEW_CHANNEL") ? [navigation[4]] : []),
          ...(can("VIEW_PROJECT") ? [navigation[5]] : []),
          navigation[1],
        ].map((n) => (
          <button
            key={n.id}
            className={view === n.id ? "active" : ""}
            aria-current={view === n.id ? "page" : undefined}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={20} />
            <span>{n.id === "notifications" ? "Réception" : n.label}</span>
            {n.id === "notifications" && unread > 0 && (
              <span className="dock-count">{unread}</span>
            )}
          </button>
        ))}
        <button aria-expanded={mobile} onClick={() => setMobile((v) => !v)}>
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>
      {quickSwitch && (
        <QuickSwitch
          channels={channels}
          can={can}
          navigate={navigate}
          openChannel={openChannel}
          search={() => setSearchMessages(true)}
          close={() => setQuickSwitch(false)}
        />
      )}
      {form && (
        <FormDialog
          title={form.title}
          fields={form.fields}
          onSave={form.save}
          onClose={() => setForm(null)}
        />
      )}
      {pwaUpdate && (
        <div className="pwa-update" role="status">
          Une mise à jour est prête. Enregistrez vos modifications avant de
          recharger.
          <button onClick={() => void applyPwaUpdate()}>
            Mettre à jour Liora
          </button>
        </div>
      )}
      {offline && (
        <div className="offline-banner" role="alert">
          <i />
          Vous êtes hors ligne. Certaines fonctionnalités peuvent être limitées.
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
