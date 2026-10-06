// src/client/ContextMenu.tsx
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export type MenuAction = {
  label: string;
  run: () => void;
  danger?: boolean;
  disabled?: boolean;
};
export type MenuState = {
  x: number;
  y: number;
  trigger: HTMLElement;
  actions: MenuAction[];
  label: string;
};
export function ContextMenu({
  menu,
  close,
}: {
  menu: MenuState;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [position, setPosition] = useState({ x: menu.x, y: menu.y });
  useLayoutEffect(() => {
    const element = ref.current!;
    const bounds = element.getBoundingClientRect();
    setPosition({
      x: Math.max(8, Math.min(menu.x, innerWidth - bounds.width - 8)),
      y: Math.max(8, Math.min(menu.y, innerHeight - bounds.height - 8)),
    });
    element
      .querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
    const dismiss = (e: Event) => {
      if (!element.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") {
        if (e.key === "Escape") e.preventDefault();
        menu.trigger.focus({ preventScroll: true });
        close();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", close);
    window.addEventListener("wheel", dismiss, { passive: true });
    window.addEventListener("touchmove", dismiss, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", close);
      window.removeEventListener("wheel", dismiss);
      window.removeEventListener("touchmove", dismiss);
    };
  }, [menu, close]);
  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      aria-label={menu.label}
      style={{ left: position.x, top: position.y }}
      onKeyDown={(e) => {
        const items = [
            ...ref.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ],
          index = items.indexOf(document.activeElement as HTMLButtonElement);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          items[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length
          ]?.focus({ preventScroll: true });
        }
      }}
    >
      {menu.actions.map((action) => (
        <button
          type="button"
          role="menuitem"
          key={action.label}
          className={action.danger ? "danger" : ""}
          disabled={action.disabled}
          onClick={() => {
            close();
            menu.trigger.focus({ preventScroll: true });
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
