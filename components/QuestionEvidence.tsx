"use client";

import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import type { StudyEvidence } from "./studyTypes";

const groups = [{ kind: "law", label: "법률" }, { kind: "case", label: "판례" }] as const;
const emptyItem = (kind: StudyEvidence["kind"]): StudyEvidence => ({ id: crypto.randomUUID(), kind, html: "" });
export type EvidenceEditorHandle = { getValues: () => StudyEvidence[] };

type EditorProps = {
  ref: Ref<EvidenceEditorHandle>;
  initial: StudyEvidence[];
  cleanHtml: (html: string) => string;
  renderEditor: (html: string, label: string) => ReactNode;
};

export function EvidenceEditor({ ref, initial, cleanHtml, renderEditor }: EditorProps) {
  const [items, setItems] = useState(() => groups.flatMap(({ kind }) => {
    const saved = initial.filter(item => item.kind === kind);
    return saved.length ? saved : [emptyItem(kind)];
  }));
  const fields = useRef(new Map<string, HTMLDivElement>());
  const snapshot = () => items.map(item => ({ ...item, html: fields.current.get(item.id)?.innerHTML ?? item.html }));
  useImperativeHandle(ref, () => ({
    getValues: () => snapshot().map(item => ({ ...item, html: cleanHtml(item.html) })).filter(item => {
      const content = document.createElement("div");
      content.innerHTML = item.html;
      return Boolean(content.textContent?.trim());
    }),
  }));

  return <div className="lex-evidence-editor">
    {groups.map(({ kind, label }) => <section key={kind} aria-label={`${label} 근거 입력`}>
      <div className="lex-evidence-editor-heading">
        <h3>{label} 근거</h3>
        <button type="button" onClick={() => setItems([...snapshot(), emptyItem(kind)])}>{label} 추가</button>
      </div>
      {items.filter(item => item.kind === kind).map((item, index) => <div className="lex-evidence-editor-row" key={item.id}>
        <div className="lex-evidence-editor-field" ref={element => {
          const field = element?.querySelector<HTMLDivElement>('[contenteditable="true"]');
          if (field) fields.current.set(item.id, field);
          else fields.current.delete(item.id);
        }}>{renderEditor(item.html, `${label} 근거 ${index + 1}`)}</div>
        <button type="button" className="lex-evidence-remove" aria-label={`${label} 근거 ${index + 1} 삭제`} onClick={() => setItems(snapshot().filter(value => value.id !== item.id))}>×</button>
      </div>)}
    </section>)}
  </div>;
}

function evidenceMarkup(html: string, kind: StudyEvidence["kind"]) {
  const content = document.createElement("div");
  content.innerHTML = html;
  content.querySelectorAll<HTMLElement>("[data-law-name][data-article-no]").forEach(link => {
    // The body formatter adds inline emphasis. Evidence has its own quieter style.
    for (const property of ["color", "font-weight", "text-decoration", "text-underline-offset"]) link.style.removeProperty(property);
    link.tabIndex = 0;
  });
  if (kind !== "case") return content.innerHTML;
  content.querySelectorAll<HTMLElement>('a[href], [data-law-name][data-article-no]').forEach(link => {
    if (link.parentElement?.closest('a[href], [data-law-name][data-article-no]')) return;
    const arrow = document.createElement("span");
    arrow.className = "study-symbol study-evidence-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(arrow);
  });
  return content.innerHTML;
}

export function QuestionEvidence({ items = [], formatHtml, onClick }: {
  items?: StudyEvidence[];
  formatHtml: (html: string) => string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  if (!items.length) return null;
  return <div className="study-evidence" aria-label="문제 근거" onClick={onClick} onKeyDown={event => {
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLElement && event.target.matches('[data-law-name][role="button"]')) {
      event.preventDefault(); event.stopPropagation(); event.target.click();
    }
  }}>
    {groups.map(({ kind, label }) => {
      const entries = items.filter(item => item.kind === kind);
      return entries.length ? <section className="study-evidence-group" aria-label={`${label} 근거`} key={kind}>
        <h3 className="study-evidence-label">{label}</h3>
        <ul>{entries.map(item => <li key={item.id} dangerouslySetInnerHTML={{ __html: evidenceMarkup(formatHtml(item.html), item.kind) }} />)}</ul>
      </section> : null;
    })}
  </div>;
}
