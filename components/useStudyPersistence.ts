"use client";
import { useEffect, useRef, useState } from "react";

type Data = { subjects: unknown[]; chapters: unknown[]; questions: unknown[] };
let saves: Promise<unknown> = Promise.resolve();
const recoveryKey = "gonglog-unsaved-study-data";
export function useStudyPersistence<T extends Data>(data: T, hydrate: (data: T) => void) {
  const [status, setStatus] = useState({ ready: false, error: "", saving: false });
  const hydrateRef = useRef(hydrate);
  useEffect(() => { hydrateRef.current = hydrate; }, [hydrate]);
  const revision = useRef<number | null>(null);
  const saved = useRef("");
  const failed = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useRef<(() => void) | null>(null);
  useEffect(() => {
    let active = true;
    void saves.then(async () => {
      const response = await fetch("/api/study-data", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!active) return;
      revision.current = result.revision;
      const { subjects, chapters, questions } = result.data;
      saved.current = JSON.stringify({ subjects, chapters, questions });
      hydrateRef.current(result.data);
      setStatus({ ready: true, error: "", saving: false });
    }).catch(error => {
      if (active) { failed.current = true; setStatus({ ready: false, error: String(error), saving: false }); }
    });
    return () => {
      active = false;
      if (pending.current) clearTimeout(pending.current);
      flush.current?.();
    };
  }, []);
  const { subjects, chapters, questions } = data;
  useEffect(() => {
    if (!status.ready || revision.current === null || failed.current) return;
    const json = JSON.stringify({ subjects, chapters, questions });
    if (json === saved.current) return;
    saved.current = json;
    try { localStorage.setItem(recoveryKey, json); } catch { /* Network save still proceeds. */ }
    if (pending.current) clearTimeout(pending.current);
    flush.current = () => {
      flush.current = null;
      saves = saves.then(async () => {
        if (failed.current) return;
        const response = await fetch("/api/study-data", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: JSON.parse(json), revision: revision.current }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        revision.current = result.revision;
        try { if (localStorage.getItem(recoveryKey) === json) localStorage.removeItem(recoveryKey); } catch { /* Storage may be disabled. */ }
        setStatus(previous => ({ ...previous, saving: false }));
      }).catch(error => {
        failed.current = true;
        setStatus(previous => ({ ...previous, error: String(error), saving: false }));
      });
    };
    pending.current = setTimeout(() => flush.current?.(), 700);
  }, [subjects, chapters, questions, status.ready]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (flush.current || failed.current) { event.preventDefault(); flush.current?.(); }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return status;
}
