"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Type } from "lucide-react";
const KEY = "lexdeck-font";
const EVENT = "lexdeck-font-change";
let preference = "default";
function read() {
  try { preference = localStorage.getItem(KEY) === "summer" ? "summer" : "default"; } catch {}
  return preference;
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback); window.addEventListener("storage", callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); };
}
export function FontPreference() {
  const font = useSyncExternalStore(subscribe, read, () => "default");
  useEffect(() => { document.documentElement.dataset.lexFont = font; }, [font]);
  return null;
}
export function FontSwitcher() {
  const font = useSyncExternalStore(subscribe, read, () => "default");
  return <label className="lex-font-switch"><Type size={16} aria-hidden="true" /><select aria-label="글꼴 선택" value={font} onChange={e => {
    preference = e.target.value;
    try { localStorage.setItem(KEY, preference); } catch {}
    document.documentElement.dataset.lexFont = preference;
    window.dispatchEvent(new Event(EVENT));
  }}><option value="default">기본 글꼴</option><option value="summer">Aa여름소리</option></select></label>;
}
