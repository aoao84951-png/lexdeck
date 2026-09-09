"use client";

import { useLayoutEffect, useRef } from "react";

// Keep the editor in the visible area when iOS pans/resizes for its keyboard.
export function useEditorViewport() {
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = overlay.current;
    if (!element) return;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const update = () => {
      if (window.innerWidth >= 1024) {
        element.style.removeProperty("top");
        element.style.removeProperty("left");
        element.style.removeProperty("width");
        element.style.removeProperty("height");
        element.style.removeProperty("bottom");
        return;
      }
      const viewport = window.visualViewport;
      Object.assign(element.style, {
        top: `${viewport?.offsetTop ?? 0}px`, left: `${viewport?.offsetLeft ?? 0}px`,
        width: `${viewport?.width ?? window.innerWidth}px`,
        height: `${viewport?.height ?? window.innerHeight}px`, bottom: "auto",
      });
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      html.style.overflow = previousOverflow;
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);
  return overlay;
}
