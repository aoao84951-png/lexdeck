"use client";
import {Eye,Pencil,Trash2,Settings2,RotateCw} from 'lucide-react';
import {ChevronLeft} from './StudySymbols';
import {useEffect,useRef,useState} from 'react';
import {FontToggle} from './FontPreference';
type Props={eyebrow:string;title:string;showBack:boolean;onBack:()=>void;onAdd:()=>void;addLabel:string;onDelete?:()=>void;onHome?:()=>void;onAddFolder?:()=>void;chapterMode?:boolean;screenTitleFix?:boolean;sortOrder?:'latest'|'oldest';onSortChange?:(v:'latest'|'oldest')=>void;unmemorized?:boolean;onToggleView?:()=>void;};
export function StudySettings({onEdit,onDelete,sortOrder,onSortChange,unmemorized,onToggleView}:{onEdit?:()=>void;onDelete?:()=>void;sortOrder?:'latest'|'oldest';onSortChange?:Props['onSortChange'];unmemorized?:boolean;onToggleView?:()=>void}={}){
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!root.current?.contains(e.target))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[open]);
 return <div ref={root} className="study-settings" onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}><button ref={trigger} type="button" aria-label="화면 설정" aria-expanded={open} onClick={()=>setOpen(!open)}><Settings2 size={20} strokeWidth={1.7}/></button>{open&&<div role="group" aria-label="화면 설정 메뉴" className="study-settings-panel">
 {onSortChange&&<button aria-label={`정렬: ${sortOrder==='latest'?'최신순':'오래된순'}`} onClick={()=>onSortChange(sortOrder==='latest'?'oldest':'latest')}><span className="study-symbol">↕</span><span>정렬</span><span className="study-font-badge">{sortOrder==='latest'?'최신순':'오래된순'}</span></button>}
 {onToggleView&&<button aria-label={`보기: ${unmemorized?'미암기만':'전체보기'}`} onClick={onToggleView}><Eye size={18}/><span>보기</span><span className="study-font-badge">{unmemorized?'미암기만':'전체보기'}</span></button>}
 {onEdit&&<button aria-label="수정" onClick={()=>{setOpen(false);onEdit();}}><Pencil size={18}/><span>수정</span></button>}
 {onDelete&&<button aria-label="삭제" onClick={()=>{setOpen(false);onDelete();}}><Trash2 size={18} color="#b36565"/><span>삭제</span></button>}
 {(onToggleView||onSortChange||onEdit)&&<hr/>}<FontToggle/><button type="button" onClick={()=>window.location.reload()}><RotateCw size={16} strokeWidth={1.6}/><span>새로고침</span></button></div>}</div>;
}
export default function StudyHeader({eyebrow,title,showBack,onBack,onAdd,addLabel,onDelete,sortOrder,onSortChange,unmemorized,onToggleView}:Props){return <header className="study-header"><div className="study-header-title">{showBack&&<button aria-label="뒤로" onClick={onBack}><ChevronLeft size={23}/></button>}<h1>{title||eyebrow||'문제 공부'}</h1></div><div className="study-header-actions"><StudySettings onEdit={addLabel==='수정'?onAdd:undefined} onDelete={onDelete} sortOrder={sortOrder} onSortChange={onSortChange} unmemorized={unmemorized} onToggleView={onToggleView}/></div></header>;}
