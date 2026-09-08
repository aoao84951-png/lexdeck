"use client";
import { ChevronLeft, MoreHorizontal, Pencil, Trash2, Settings2, RotateCw } from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {FontSwitcher} from "./FontPreference";

type Props = {eyebrow: string; title: string; showBack: boolean; onBack: () => void; onAdd: () => void; addLabel: string; onDelete?: () => void; onHome?: () => void; onAddFolder?: () => void; chapterMode?: boolean; screenTitleFix?: boolean; sortOrder?: "latest" | "oldest"; onSortChange?: (value:"latest"|"oldest")=>void;};
export function StudySettings() {
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(e.target instanceof Node&&!root.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 return <div ref={root} className="study-settings"><button type="button" aria-label="화면 설정" aria-expanded={open} onClick={()=>setOpen(!open)}><Settings2 size={20}/></button>{open&&<div className="study-settings-panel"><FontSwitcher/><button type="button" onClick={()=>window.location.reload()}><RotateCw size={16}/>새로고침</button></div>}</div>;
}
export default function StudyHeader({eyebrow,title,showBack,onBack,onAdd,addLabel,onDelete,sortOrder,onSortChange}:Props) {
 const [open,setOpen]=useState(false);const root=useRef<HTMLElement>(null);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(e.target instanceof Node&&!root.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 return <header ref={root} className="study-header"><div className="study-header-title">{showBack&&<button type="button" aria-label="뒤로" onClick={onBack}><ChevronLeft size={23}/></button>}<div>{title&&<h1>{title}</h1>}{!title&&<h1>{eyebrow || "문제 공부"}</h1>}</div></div><div className="study-header-actions">{onSortChange&&<select aria-label="정렬" value={sortOrder} onChange={e=>onSortChange(e.target.value as "latest"|"oldest")}><option value="latest">최신순</option><option value="oldest">오래된순</option></select>}{addLabel==="수정"&&<><button type="button" aria-label="문제 관리" aria-expanded={open} onClick={()=>setOpen(!open)}><MoreHorizontal size={22}/></button>{open&&<div className="study-question-menu"><button type="button" aria-label="수정" onClick={()=>{setOpen(false);onAdd();}}><Pencil size={16}/>문제 수정</button><button type="button" onClick={()=>{setOpen(false);onDelete?.();}}><Trash2 size={16}/>문제 삭제</button></div>}</>}<StudySettings/></div></header>;
}
