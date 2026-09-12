"use client";

import { useLayoutEffect } from "react";

export function useDetailScroll(screen: string, questionId: string, editorOpen: boolean) {
  useLayoutEffect(() => {
    if (screen === "detail" && !editorOpen) {
      // These screens share a document rather than navigating to another URL.
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [screen, questionId, editorOpen]);
}
