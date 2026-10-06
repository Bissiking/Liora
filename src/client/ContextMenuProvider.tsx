// src/client/ContextMenuProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { ContextMenu, type MenuAction, type MenuState } from "./ContextMenu";
const MenuContext = createContext<(menu: MenuState) => void>(() => {});
export function nativeTarget(target: EventTarget | null) {
  return (
    !!(
      target instanceof Element &&
      target.closest(
        "input,textarea,select,[contenteditable],pre,code,[data-native-menu]",
      )
    ) || !!window.getSelection()?.toString()
  );
}
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const close = useCallback(() => setMenu(null), []);
  return (
    <MenuContext.Provider value={setMenu}>
      {children}
      {menu && <ContextMenu menu={menu} close={close} />}
    </MenuContext.Provider>
  );
}
export function useContextMenu() {
  return useContext(MenuContext);
}
export function useEntityMenu(label: string, actions: MenuAction[]) {
  const show = useContext(MenuContext);
  const open = (trigger: HTMLElement, x?: number, y?: number) => {
    if (!actions.length) return;
    const r = trigger.getBoundingClientRect();
    show({ label, actions, trigger, x: x ?? r.left, y: y ?? r.bottom });
  };
  return {
    open,
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      if (nativeTarget(e.target) || !actions.length) return;
      e.preventDefault();
      e.stopPropagation();
      open(e.currentTarget, e.clientX, e.clientY);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "F10" && e.shiftKey && !nativeTarget(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        open(e.currentTarget);
      }
    },
  };
}
export function EntityMenuButton({
  label,
  actions,
}: {
  label: string;
  actions: MenuAction[];
}) {
  const menu = useEntityMenu(label, actions);
  if (!actions.length) return null;
  return (
    <button
      className="icon-button entity-menu-button"
      aria-label={`Actions : ${label}`}
      aria-haspopup="menu"
      onClick={(e) => menu.open(e.currentTarget)}
      onKeyDown={menu.onKeyDown}
    >
      <MoreHorizontal size={19} />
    </button>
  );
}
export function EntityMenu({
  label,
  actions,
  children,
  className = "",
  showButton = true,
}: {
  label: string;
  actions: MenuAction[];
  children: ReactNode;
  className?: string;
  showButton?: boolean;
}) {
  const menu = useEntityMenu(label, actions);
  return (
    <div
      className={`entity-surface ${className}`}
      tabIndex={0}
      aria-label={label}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
    >
      {children}
      {showButton && <EntityMenuButton label={label} actions={actions} />}
    </div>
  );
}
