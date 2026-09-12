"use client";

import { useEffect, useEffectEvent } from "react";

const openDialogs: (() => void)[] = [];
const handleEscape = (event: KeyboardEvent) => {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.repeat) return;
  const close = openDialogs.at(-1);
  if (!close) return;
  event.preventDefault();
  close();
};

// Nested controls handle Escape first; only the top remaining dialog closes.
export function useEscapeClose(onClose: () => void) {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const dismiss = () => close();
    if (!openDialogs.length) window.addEventListener("keydown", handleEscape);
    openDialogs.push(dismiss);
    return () => {
      const index = openDialogs.indexOf(dismiss);
      if (index !== -1) openDialogs.splice(index, 1);
      if (!openDialogs.length) window.removeEventListener("keydown", handleEscape);
    };
  }, []);
}
