// src/client/theme-preference.ts
import { themeId } from "../shared/themes";
import type { User } from "./types";
const volatile = new Map<string, { sync: boolean; theme: string }>();
const key = (user: string) => "liora.appearance." + user;
export function deviceAppearance(user: User) {
  let local: { sync?: boolean; theme?: string } = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(key(user.id)) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      local = parsed;
  } catch {
    /* unavailable storage uses account defaults */
  }
  local = volatile.get(user.id) || local;
  return {
    sync: local.sync !== false,
    theme: themeId(local.sync === false ? local.theme : user.preferences.theme),
  };
}
export function saveDeviceAppearance(
  user: string,
  sync: boolean,
  theme: string,
) {
  try {
    localStorage.setItem(
      key(user),
      JSON.stringify({ sync, theme: themeId(theme) }),
    );
  } catch {
    volatile.set(user, { sync, theme: themeId(theme) });
  }
  document.documentElement.dataset.theme = themeId(theme);
  window.dispatchEvent(new Event("liora:appearance"));
}
