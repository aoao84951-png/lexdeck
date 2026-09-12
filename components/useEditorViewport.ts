"use client";

import { useLayoutEffect, useRef } from "react";
import { isMobileLayout } from "./responsiveLayout";
import { acquireDocumentOverflow } from "./documentOverflow";

// The mobile form scrolls with the document; only its controls track the viewport.
export function useEditorViewport() {
  const overlay = useRef<HTMLDivElement>(null);
  const scrollBeforeOpen = useRef(typeof window === "undefined" ? 0 : window.scrollY);
  useLayoutEffect(() => {
    const element = overlay.current;
    if (!element) return;
    const mobile = isMobileLayout();
    const releaseOverflow = acquireDocumentOverflow(mobile ? "auto" : "hidden");
    if (mobile) window.scrollTo(0, 0);
    const savedScroll = scrollBeforeOpen.current;
    const footer = element.querySelector<HTMLElement>(".lex-editor-footer");
    const measureFooter = () => element.style.setProperty("--lex-footer-height", `${footer?.getBoundingClientRect().height ?? 68}px`);
    const footerObserver = new ResizeObserver(measureFooter);
    if (footer) footerObserver.observe(footer);
    measureFooter();
    let baselineHeight = window.innerHeight;
    let baselineWidth = window.innerWidth;
    let keyboardOpen = false;
    let frame = 0;
    const update = () => {
      if (!isMobileLayout()) {
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
      element.style.setProperty("--lex-keyboard-inset", `${Math.max(0, window.innerHeight - height)}px`);
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
      footerObserver.disconnect();
      releaseOverflow();
      if (mobile) requestAnimationFrame(() => {
        // Detail navigation owns its starting position, including after saving.
        if (!document.querySelector(".lex-editor-overlay") &&
          document.querySelector(".lex-app")?.getAttribute("data-study-screen") !== "detail") {
          window.scrollTo(0, savedScroll);
        }
      });
      document.removeEventListener("focusin", focusChanged);
      document.removeEventListener("focusout", focusChanged);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);
  return overlay;
}
