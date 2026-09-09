"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Bold, Underline, Italic, Strikethrough, Palette, Link, Unlink, Scale, RemoveFormatting } from "lucide-react";
import { X, Plus } from "./StudySymbols";

import { readEditorSelection, restoreEditorSelection, selectedEditorColors, paletteColorMatches, type EditorSelection } from "./editorSelection";

type Props = {
  runCommand: (command: string, value?: string) => void;
  insertLink: (url: string) => void;
  insertLawLink: (name: string, article: string) => void;
  unlinkLawLink: () => void;
  unlinkSelectedAutoLawLink: () => void;
  customColors: string[];
  saveCustomColors: (colors: string[]) => void;
  saveSelection: () => void;
};
const actions = [[Bold, "굵게", "bold"], [Underline, "밑줄", "underline"], [Italic, "기울임", "italic"], [Strikethrough, "취소선", "strikeThrough"], [RemoveFormatting, "서식 지우기", "removeFormat"]] as const;
const colors = ["#303236", "#858585", "#a77c65", "#d57a36", "#c79832", "#4e9473", "#397dcc", "#9268bb", "#c54b88", "#d9514d"];
const backgrounds = ["transparent", "#efefed", "#f4eae5", "#fdebdc", "#fff4cc", "#e5f2e9", "#e3f0ff", "#f0e8fb", "#fbe5ef", "#fde5e4"];
const names = ["기본", "회색", "갈색", "주황", "노랑", "초록", "파랑", "보라", "분홍", "빨강"];

export default function EditorToolbar(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const bookmark = useRef<Range | null>(null);
  const [panel, setPanel] = useState<"color" | "link" | null>(null);
  const [floating, setFloating] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const [active, setActive] = useState<string[]>([]);
  const [colorType, setColorType] = useState<"text" | "background">("text");
  const [newColor, setNewColor] = useState("#c79832");
  const [linkType, setLinkType] = useState<"web" | "law">("web");
  const [url, setUrl] = useState("");
  const [law, setLaw] = useState("");
  const [article, setArticle] = useState("");
  const [error, setError] = useState("");

  const panelRef = useRef<"color" | "link" | null>(null);
  const keyboard = useRef<{ editor: HTMLElement; value: string | null } | null>(null);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [selectionText, setSelectionText] = useState("");
  const pendingSelection = useRef<EditorSelection | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedColors, setSelectedColors] = useState<{text: string | null; background: string | null}>({text: null, background: null});
  const field = () => host.current?.nextElementSibling as HTMLElement | null;
  const isMobile = () => window.innerWidth < 1024;
  const releaseKeyboard = () => {
    const previous = keyboard.current;
    if (!previous) return;
    if (previous.value === null) previous.editor.removeAttribute("inputmode");
    else previous.editor.setAttribute("inputmode", previous.value);
    keyboard.current = null;
  };
  const capture = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (field()?.contains(range.startContainer) && field()?.contains(range.endContainer)) bookmark.current = range.cloneRange();
  };
  const restore = () => {
    const editor = field();
    const range = bookmark.current;
    if (!editor || !range || range.collapsed || !editor.contains(range.commonAncestorContainer)) return false;
    editor.focus({ preventScroll: true });
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
    props.saveSelection();
    return true;
  };
  const perform = (action: () => void) => {
    if (!restore()) { setError("먼저 편집할 글자를 선택해 주세요."); return false; }
    const editor = field()!;
    const offsets = readEditorSelection(editor, bookmark.current!);
    action();
    bookmark.current = restoreEditorSelection(editor, offsets);
    pendingSelection.current = offsets;
    setRevision(value => value + 1);
    if (bookmark.current) setSelectedColors(selectedEditorColors(editor, bookmark.current));
    setActive(actions.filter(([, , command]) => command !== "removeFormat" && document.queryCommandState(command)).map(([, , command]) => command));
    return true;
  };
  const closePanel = () => {
    panelRef.current = null; setPanel(null); setError("");
    const hadKeyboard = !!keyboard.current;
    releaseKeyboard();
    if (hadKeyboard) { field()?.blur(); restore(); }
  };
  const dismiss = () => {
    if (panelRef.current) { closePanel(); return; }
    releaseKeyboard(); field()?.blur(); setFloating(false); setError("");
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const updateDock = () => setDock(media.matches ? host.current?.closest<HTMLElement>(".lex-editor-dialog") ?? null : null);
    updateDock();
    media.addEventListener("change", updateDock);
    return () => media.removeEventListener("change", updateDock);
  }, []);

  useEffect(() => {
    const hide = () => { releaseKeyboard(); panelRef.current = null; setPanel(null); setFloating(false); setError(""); };
    const update = () => {
      if (panelRef.current || surface.current?.contains(document.activeElement)) return;
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const editor = host.current?.nextElementSibling as HTMLElement | null;
      if (!range || selection?.isCollapsed || document.activeElement !== editor || !editor?.contains(range.startContainer) || !editor.contains(range.endContainer)) {
        setFloating(false); return;
      }
      bookmark.current = range.cloneRange(); setFloating(true);
      setSelectedColors(selectedEditorColors(editor, range));
      setActive(actions.filter(([, , command]) => command !== "removeFormat" && document.queryCommandState(command)).map(([, , command]) => command));
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || surface.current?.contains(event.target)) return;
      // A drag in the editor is a scroll/selection gesture, not a dismissal.
      if (panelRef.current && host.current?.closest(".lex-editor-body")?.contains(event.target)) return;
      hide();
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches('[contenteditable="true"]') && event.target !== field()) hide();
    };
    document.addEventListener("focusin", focus);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("selectionchange", update); document.addEventListener("pointerup", update);
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => {
      releaseKeyboard();
      document.removeEventListener("focusin", focus);
      document.removeEventListener("selectionchange", update); document.removeEventListener("pointerup", update);
      document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);
    };
  }, []);

  useLayoutEffect(() => {
    const editor = host.current?.nextElementSibling as HTMLElement | null;
    if (!editor || !pendingSelection.current) return;
    bookmark.current = restoreEditorSelection(editor, pendingSelection.current);
    pendingSelection.current = null;
  }, [revision]);

  useLayoutEffect(() => {
    if (!floating && !panel) return;
    const place = () => {
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      const element = surface.current;
      const bounds = bookmark.current?.getBoundingClientRect();
      if (!element || !bounds) return;
      if (dock) {
        element.style.setProperty("--lex-panel-height", `${Math.min(340, height * .42)}px`);
        setPosition({});
      } else {
        const panelWidth = Math.min(352, width - 24);
        const panelHeight = element.getBoundingClientRect().height;
        setPosition({ position: "fixed", width: panelWidth,
          left: Math.max(left + 12, Math.min(bounds.left, left + width - panelWidth - 12)),
          top: Math.max(top + 12, Math.min(bounds.top > panelHeight + 20 ? bounds.top - panelHeight - 10 : bounds.bottom + 10, top + height - panelHeight - 12)),
          maxHeight: Math.max(100, height - 24), zIndex: 200 });
      }
    };
    const revealSelection = () => {
      if (!dock) return;
      const body = host.current?.closest<HTMLElement>(".lex-editor-body");
      const range = bookmark.current;
      if (!body || !range) return;
      const visible = body.getBoundingClientRect();
      const selected = range.getBoundingClientRect();
      const available = visible.height - 24;
      if (selected.height > available || selected.top < visible.top + 12) body.scrollTop += selected.top - visible.top - 12;
      else if (selected.bottom > visible.bottom - 12) body.scrollTop += selected.bottom - visible.bottom + 12;
    };
    let frame = 0;
    const layout = () => { place(); cancelAnimationFrame(frame); frame = requestAnimationFrame(revealSelection); };
    layout();
    const observer = new ResizeObserver(layout);
    if (surface.current) observer.observe(surface.current);
    window.visualViewport?.addEventListener("resize", layout); window.visualViewport?.addEventListener("scroll", layout);
    window.addEventListener("resize", layout); if (!dock) document.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); window.visualViewport?.removeEventListener("resize", layout); window.visualViewport?.removeEventListener("scroll", layout);
      window.removeEventListener("resize", layout); document.removeEventListener("scroll", place, true);
    };
  }, [floating, panel, props.customColors.length, error, linkType, dock]);

  const toggle = (next: "color" | "link") => {
    capture(); setSelectionText(bookmark.current?.toString() ?? ""); setError("");
    if (panelRef.current === next) { closePanel(); return; }
    releaseKeyboard();
    panelRef.current = next; setPanel(next);
    const editor = field();
    if (isMobile() && editor && bookmark.current) {
      const offsets = readEditorSelection(editor, bookmark.current);
      keyboard.current = { editor, value: editor.getAttribute("inputmode") };
      editor.setAttribute("inputmode", "none"); editor.blur(); editor.focus({ preventScroll: true });
      bookmark.current = restoreEditorSelection(editor, offsets);
    }
  };
  const applyLink = () => {
    if (!bookmark.current || bookmark.current.collapsed) { setError("연결할 글자를 먼저 선택해 주세요."); return; }
    if (linkType === "web") {
      let target: URL;
      try { target = new URL(url.trim()); } catch { setError("https://로 시작하는 링크 주소를 입력해 주세요."); return; }
      if (!["https:", "http:", "mailto:"].includes(target.protocol)) { setError("웹 주소 또는 mailto: 이메일 링크를 입력해 주세요."); return; }
      perform(() => props.insertLink(target.href));
    } else {
      if (!law.trim() || !/^(?:제\s*)?\d+(?:조)?(?:의\s*\d+)?$/.test(article.trim())) { setError("법령명과 조문 번호를 확인해 주세요. 예: 민법, 750 또는 14의2"); return; }
      perform(() => props.insertLawLink(law.trim(), article.trim().replace(/^제\s*/, "").replace(/조/g, "").replace(/\s/g, "")));
    }
    closePanel();
  };
  const floatingSurface = floating || !!panel;
  const controls = <div ref={surface} className={`lex-tools lex-tools-floating ${dock ? "lex-tools-docked" : ""} ${panel ? "lex-tools-expanded" : ""}`} style={floatingSurface ? position : undefined}>
    <div className="lex-tools-row" role="toolbar" aria-label="텍스트 서식" onPointerDown={e => { if ((e.target as HTMLElement).closest("button")) { capture(); e.preventDefault(); } }}>
      {actions.map(([Icon, label, command]) => <button key={command} type="button" title={label} aria-label={label} aria-pressed={active.includes(command)} onClick={() => perform(() => props.runCommand(command))}><Icon size={18} strokeWidth={1.8} /></button>)}

      <button type="button" title="글자색 및 배경색" aria-label="글자색 및 배경색" aria-expanded={panel === "color"} onClick={() => toggle("color")}><Palette size={19} strokeWidth={1.8} /></button>
      <button type="button" title="링크 및 법령 연결" aria-label="링크 및 법령 연결" aria-expanded={panel === "link"} onClick={() => toggle("link")}><Link size={18} strokeWidth={1.8} /></button>
      {floatingSurface && <button type="button" aria-label="서식 도구 닫기" onClick={dismiss}><X size={16} /></button>}
    </div>
    {panel === "color" && <div className="lex-tools-panel">
      {(["text", "background"] as const).map(kind => <section key={kind} aria-label={kind === "text" ? "텍스트 색상" : "배경 색상"}>
        <h3 className="lex-panel-label">{kind === "text" ? "글자색" : "배경색"}</h3>
        <div className="lex-color-grid lex-default-colors">{(kind === "text" ? colors : backgrounds).map((color, index) => <button type="button" key={color}
          aria-label={`${kind === "text" ? "글자색" : "배경색"} ${names[index]}`} aria-pressed={paletteColorMatches(selectedColors[kind], color)}
          title={`${names[index]} ${kind === "text" ? "텍스트" : "배경"}`} onClick={() => perform(() => props.runCommand(kind === "text" ? "foreColor" : "hiliteColor", color))}>
          {kind === "text" ? <><span className="lex-color-letter lex-desktop-letter" style={{color}}>A</span><span className="lex-color-letter lex-mobile-letter" style={{color}}>가</span></> : <span className={`lex-color-swatch ${index === 0 ? "lex-color-default" : ""}`} style={{backgroundColor: color}}><span className="lex-desktop-letter">{index === 0 ? "∅" : ""}</span></span>}
          <span className="lex-color-name">{names[index]} {kind === "text" ? "텍스트" : "배경"}</span>
        </button>)}</div>
      </section>)}
      <details className="lex-custom-colors"><summary>내 색상</summary>
      <div className="lex-segments">{(["text", "background"] as const).map(kind => <button type="button" key={kind} aria-pressed={colorType === kind} onClick={() => setColorType(kind)}>{kind === "text" ? "글자색" : "배경색"}</button>)}</div>

      {props.customColors.length > 0 && <div className="lex-color-grid">{props.customColors.map(color => <span key={color} className="lex-custom-color"><button type="button" title={color} aria-label={`사용자 색상 ${color}`} style={{ background: color }} onClick={() => perform(() => props.runCommand(colorType === "text" ? "foreColor" : "hiliteColor", color))} /><button type="button" className="lex-delete-color" aria-label={`${color} 색상 삭제`} onClick={() => props.saveCustomColors(props.customColors.filter(value => value !== color))}><X size={11} /></button></span>)}</div>}
      <div className="lex-color-add"><input type="color" aria-label="새 색상 선택" value={/^#[0-9a-f]{6}$/i.test(newColor) ? newColor : "#c79832"} onChange={e => setNewColor(e.target.value)} /><input aria-label="색상 코드" value={newColor} maxLength={7} onChange={e => setNewColor(e.target.value)} /><button type="button" aria-label="내 색상 추가" onClick={() => { if (!/^#[0-9a-f]{6}$/i.test(newColor)) { setError("#C79832처럼 6자리 색상 코드를 입력해 주세요."); return; } props.saveCustomColors(Array.from(new Set([...props.customColors, newColor.toLowerCase()]))); setError(""); }}><Plus size={17} />추가</button></div>
    </details></div>}
    {panel === "link" && <div className="lex-tools-panel">
      <p className="lex-selection-preview" title={selectionText}>선택한 글: {selectionText}</p>
      <div className="lex-segments"><button type="button" aria-pressed={linkType === "web"} onClick={() => { setLinkType("web"); setError(""); }}><Link size={14} />웹 링크</button><button type="button" aria-pressed={linkType === "law"} onClick={() => { setLinkType("law"); setError(""); }}><Scale size={14} />법령 연결</button></div>
      <div className="lex-link-fields" onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); applyLink(); } }}>
        {linkType === "web" ? <label>링크 주소<input aria-label="링크 주소" placeholder="https://" value={url} onChange={e => setUrl(e.target.value)} /></label> : <><label>법령명<input aria-label="법령명" placeholder="예: 민법" value={law} onChange={e => setLaw(e.target.value)} /></label><label>조문 번호<input aria-label="조문 번호" placeholder="예: 750, 14의2" value={article} onChange={e => setArticle(e.target.value)} /></label></>}
        <button type="button" className="lex-apply-link" onClick={applyLink}>선택한 글자에 연결</button>
      </div>
      <div className="lex-link-removal"><button type="button" onClick={() => { perform(props.unlinkLawLink); closePanel(); }}><Unlink size={14} />링크 해제</button><button type="button" onClick={() => { perform(props.unlinkSelectedAutoLawLink); closePanel(); }}>자동 법령 연결 해제</button></div>
    </div>}
    {error && <p role="alert" className="lex-tool-error">{error}</p>}
  </div>;
  return <><div ref={host} hidden aria-hidden="true" />{floatingSurface && createPortal(controls, dock ?? document.body)}</>;
}
