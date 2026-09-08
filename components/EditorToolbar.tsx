"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Bold, Underline, Italic, Strikethrough, Palette, Link, X, Unlink, Scale, Plus } from "lucide-react";

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
const actions = [[Bold, "굵게", "bold"], [Underline, "밑줄", "underline"], [Italic, "기울임", "italic"], [Strikethrough, "취소선", "strikeThrough"]] as const;
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
  const [newColor, setNewColor] = useState("#48685b");
  const [linkType, setLinkType] = useState<"web" | "law">("web");
  const [url, setUrl] = useState("");
  const [law, setLaw] = useState("");
  const [article, setArticle] = useState("");
  const [error, setError] = useState("");

  const field = () => host.current?.nextElementSibling as HTMLElement | null;
  const capture = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (field()?.contains(range.startContainer) && field()?.contains(range.endContainer)) bookmark.current = range.cloneRange();
  };
  const restore = () => {
    const editor = field();
    const range = bookmark.current;
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) return false;
    editor.focus({ preventScroll: true });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    props.saveSelection();
    return true;
  };
  const perform = (action: () => void) => {
    if (!restore()) { setError("먼저 편집할 글자를 선택해 주세요."); return; }
    action();
    capture();
    setActive(actions.filter(([, , command]) => document.queryCommandState(command)).map(([, , command]) => command));
  };

  useEffect(() => {
    const update = () => {
      if (panel || surface.current?.contains(document.activeElement)) return;
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const editor = host.current?.nextElementSibling;
      if (!range || !editor?.contains(range.startContainer) || !editor.contains(range.endContainer)) {
        setFloating(false); return;
      }
      bookmark.current = range.cloneRange();
      setFloating(!selection?.isCollapsed);
      setActive(actions.filter(([, , command]) => document.queryCommandState(command)).map(([, , command]) => command));
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || surface.current?.contains(event.target) || host.current?.contains(event.target)) return;
      setPanel(null); setError(""); setFloating(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPanel(null); setFloating(false); setError(""); }
    };
    document.addEventListener("selectionchange", update);
    document.addEventListener("pointerup", update);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("pointerup", update);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);

  useLayoutEffect(() => {
    if (!floating && !panel) return;
    const place = () => {
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      const bounds = bookmark.current?.getBoundingClientRect() ?? host.current?.getBoundingClientRect();
      if (!bounds) return;
      const panelWidth = Math.min(336, width - 24);
      const panelHeight = surface.current?.getBoundingClientRect().height ?? 52;
      const mobile = window.innerWidth < 768;
      setPosition({ position: "fixed", width: panelWidth,
        left: mobile ? left + (width - panelWidth) / 2 : Math.max(left + 12, Math.min(bounds.left, left + width - panelWidth - 12)),
        top: mobile ? Math.max(top + 12, top + height - panelHeight - 12) : Math.max(top + 12, Math.min(bounds.top > panelHeight + 20 ? bounds.top - panelHeight - 10 : bounds.bottom + 10, top + height - panelHeight - 12)),
        maxHeight: Math.max(100, height - 24), zIndex: 100 });
    };
    place();
    const observer = new ResizeObserver(place);
    if (surface.current) observer.observe(surface.current);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect(); window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place); window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [floating, panel, colorType, linkType, props.customColors.length, error]);

  const toggle = (next: "color" | "link") => {
    capture(); setError(""); setPanel(panel === next ? null : next);
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
    setPanel(null); setError("");
  };
  const floatingSurface = floating || !!panel;
  const controls = <div ref={surface} className={`lex-tools ${floatingSurface ? "lex-tools-floating" : ""}`} style={floatingSurface ? position : undefined}>
    <div className="lex-tools-row" role="toolbar" aria-label="텍스트 서식" onPointerDown={e => { if ((e.target as HTMLElement).closest("button")) { capture(); e.preventDefault(); } }}>
      {actions.map(([Icon, label, command]) => <button key={command} type="button" title={label} aria-label={label} aria-pressed={active.includes(command)} onClick={() => perform(() => props.runCommand(command))}><Icon size={18} strokeWidth={1.8} /></button>)}
      <span className="lex-tools-divider" />
      <button type="button" title="글자색 및 배경색" aria-label="글자색 및 배경색" aria-expanded={panel === "color"} onClick={() => toggle("color")}><Palette size={19} strokeWidth={1.8} /></button>
      <button type="button" title="링크 및 법령 연결" aria-label="링크 및 법령 연결" aria-expanded={panel === "link"} onClick={() => toggle("link")}><Link size={18} strokeWidth={1.8} /></button>
      {floatingSurface && <button type="button" aria-label="서식 도구 닫기" onClick={() => { setPanel(null); setFloating(false); }}><X size={16} /></button>}
    </div>
    {panel === "color" && <div className="lex-tools-panel">
      <div className="lex-segments">{(["text", "background"] as const).map(type => <button type="button" key={type} aria-pressed={colorType === type} onClick={() => setColorType(type)}>{type === "text" ? "글자색" : "배경색"}</button>)}</div>
      <div className="lex-color-grid">{(colorType === "text" ? colors : backgrounds).map((color, index) => <button type="button" key={color} aria-label={`${colorType === "text" ? "글자색" : "배경색"} ${names[index]}`} title={names[index]} style={{ color: colorType === "text" ? color : "#48685b", background: colorType === "background" ? color : undefined }} onClick={() => perform(() => props.runCommand(colorType === "text" ? "foreColor" : "hiliteColor", color))}>{colorType === "text" ? "A" : index === 0 ? "∅" : ""}</button>)}</div>
      <p className="lex-panel-label">내 색상</p>
      {props.customColors.length > 0 && <div className="lex-color-grid">{props.customColors.map(color => <span key={color} className="lex-custom-color"><button type="button" title={color} aria-label={`사용자 색상 ${color}`} style={{ background: color }} onClick={() => perform(() => props.runCommand(colorType === "text" ? "foreColor" : "hiliteColor", color))} /><button type="button" className="lex-delete-color" aria-label={`${color} 색상 삭제`} onClick={() => props.saveCustomColors(props.customColors.filter(value => value !== color))}><X size={11} /></button></span>)}</div>}
      <div className="lex-color-add"><input type="color" aria-label="새 색상 선택" value={/^#[0-9a-f]{6}$/i.test(newColor) ? newColor : "#48685b"} onChange={e => setNewColor(e.target.value)} /><input aria-label="색상 코드" value={newColor} maxLength={7} onChange={e => setNewColor(e.target.value)} /><button type="button" aria-label="내 색상 추가" onClick={() => { if (!/^#[0-9a-f]{6}$/i.test(newColor)) { setError("#48685B처럼 6자리 색상 코드를 입력해 주세요."); return; } props.saveCustomColors(Array.from(new Set([...props.customColors, newColor.toLowerCase()]))); setError(""); }}><Plus size={17} />추가</button></div>
    </div>}
    {panel === "link" && <div className="lex-tools-panel">
      <div className="lex-segments"><button type="button" aria-pressed={linkType === "web"} onClick={() => { setLinkType("web"); setError(""); }}><Link size={14} />웹 링크</button><button type="button" aria-pressed={linkType === "law"} onClick={() => { setLinkType("law"); setError(""); }}><Scale size={14} />법령 연결</button></div>
      <div className="lex-link-fields" onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); applyLink(); } }}>
        {linkType === "web" ? <label>링크 주소<input aria-label="링크 주소" placeholder="https://" value={url} onChange={e => setUrl(e.target.value)} /></label> : <><label>법령명<input aria-label="법령명" placeholder="예: 민법" value={law} onChange={e => setLaw(e.target.value)} /></label><label>조문 번호<input aria-label="조문 번호" placeholder="예: 750, 14의2" value={article} onChange={e => setArticle(e.target.value)} /></label></>}
        <button type="button" className="lex-apply-link" onClick={applyLink}>선택한 글자에 연결</button>
      </div>
      <div className="lex-link-removal"><button type="button" onClick={() => { perform(props.unlinkLawLink); setPanel(null); }}><Unlink size={14} />링크 해제</button><button type="button" onClick={() => { perform(props.unlinkSelectedAutoLawLink); setPanel(null); }}>자동 법령 연결 해제</button></div>
    </div>}
    {error && <p role="alert" className="lex-tool-error">{error}</p>}
  </div>;
  return <div ref={host} className="lex-toolbar-host">{floatingSurface ? <><span className="lex-selection-hint">선택한 글자의 서식을 편집하고 있어요</span>{createPortal(controls, document.body)}</> : controls}</div>;
}
