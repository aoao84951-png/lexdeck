"use client";

import { useLayoutEffect, useRef } from "react";

// Resize only the dialog: the opaque overlay must still cover the layout viewport
// underneath Safari's translucent keyboard accessory and browser controls.
export function useEditorViewport() {
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = overlay.current;
    if (!element) return;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    let baselineHeight = window.innerHeight;
    let baselineWidth = window.innerWidth;
    let keyboardOpen = false;
    let frame = 0;
    const update = () => {
      if (window.innerWidth >= 1024) {
        delete element.dataset.keyboardOpen;
        return;
      }
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      if (Math.abs(window.innerWidth - baselineWidth) > 100) {
        baselineWidth = window.innerWidth;
        baselineHeight = window.innerHeight;
      }
      baselineHeight = Math.max(baselineHeight, window.innerHeight, height);
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement && element.contains(focused) &&
        (focused.isContentEditable || focused.matches('input:not([type="color"]), textarea'));
      keyboardOpen = baselineHeight - height > 120 && (editing || keyboardOpen);
      element.dataset.keyboardOpen = String(keyboardOpen);
      element.style.setProperty("--lex-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      element.style.setProperty("--lex-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
      element.style.setProperty("--lex-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
      element.style.setProperty("--lex-viewport-height", `${height}px`);
    };
    // focusout fires before the next input receives focus.
    const focusChanged = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    document.addEventListener("focusin", focusChanged);
    document.addEventListener("focusout", focusChanged);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      html.style.overflow = previousOverflow;
      document.removeEventListener("focusin", focusChanged);
      document.removeEventListener("focusout", focusChanged);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);
  return overlay;
}
