"use client";
import {useState} from "react";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { CornerUpRight, X, ArrowUp, ArrowDown } from "./StudySymbols";
import {FolderSymbolPicker} from "./FolderSymbols";
import StudyBookCoverInput from "./StudyBookCoverInput";
import {chapterPath,type StudyChapter,type StudySubject} from "./studyTypes";

export type TreeAction={kind:'add'|'edit'|'move'|'delete'|'up'|'down';id:string;subject:boolean;title?:string;icon?:string;desc?:string;coverImage?:string;isBook?:boolean;targetSubjectId?:string;type?:'folder'|'chapter';parentId?:string|null;relativeId?:string;placement?:'before'|'after'};
type Props={initialMode?:TreeAction['kind']|null;initialType?:'chapter'|'folder';id:string;subject:boolean;title:string;icon?:string;desc?:string;coverImage?:string;isBook?:boolean;chapters:StudyChapter[];subjects:StudySubject[];subjectId:string;onAction:(action:TreeAction)=>void;onClose:()=>void};
export default function StudyTreeActions({id,subject,title:original,icon:originalIcon,desc:originalDesc,coverImage:originalCover,isBook:originalBook,chapters,subjects,subjectId,onAction,onClose,initialMode=null,initialType='chapter'}:Props){
 const [mode,setMode]=useState<TreeAction['kind']|null>(initialMode);
 const [title,setTitle]=useState(initialMode==='add'?'':original),[icon,setIcon]=useState(originalIcon??'#'),[desc,setDesc]=useState(initialMode==='add'?'':originalDesc??'');
 const [coverImage,setCoverImage]=useState(initialMode==='add'?'':originalCover??''),[isBook,setIsBook]=useState(initialMode==='add'?false:originalBook??Boolean(originalCover)),[coverBusy,setCoverBusy]=useState(false);
 const [symbols,setSymbols]=useState(false),[type,setType]=useState<'chapter'|'folder'>(initialType),[parent,setParent]=useState('');
 const subjectEdit=subject&&mode==='edit';
 const excluded=new Set([id]);let size=0;while(size!==excluded.size){size=excluded.size;chapters.forEach(c=>{if(c.parentId&&excluded.has(c.parentId))excluded.add(c.id);});}
 const finish=(kind:TreeAction['kind'])=>{onAction({kind,id,subject,title:title.trim(),icon:mode==='add'?'':subjectEdit?icon:originalIcon??'',desc,type,coverImage,isBook,parentId:parent.startsWith('c:')?parent.slice(2):null,targetSubjectId:parent.startsWith('s:')?parent.slice(2):parent.startsWith('c:')?chapters.find(c=>c.id===parent.slice(2))?.subjectId:subjectId});onClose();};
 return <div className="study-inline-actions" role="group" aria-label={`${original} 관리 영역`}>
  <div className="study-inline-tools"><div>{([{kind:'add',label:'추가',Icon:FolderPlus},{kind:'edit',label:'수정',Icon:Pencil},{kind:'move',label:'이동',Icon:CornerUpRight},{kind:'delete',label:'삭제',Icon:Trash2}] as const).map(({kind,label,Icon})=><button key={kind} disabled={coverBusy} aria-pressed={mode===kind} onClick={()=>{setMode(kind);setTitle(kind==='add'?'':original);setIcon(originalIcon??'#');setDesc(kind==='add'?'':originalDesc??'');setCoverImage(kind==='add'?'':originalCover??'');setIsBook(kind==='add'?false:originalBook??Boolean(originalCover));setSymbols(false);}}><Icon size={13}/>{label}</button>)}</div><button aria-label="관리 닫기" onClick={onClose}><X size={14}/></button></div>
  {(mode==='add'||mode==='edit')&&<form onSubmit={e=>{e.preventDefault();if(title.trim()&&!coverBusy)finish(mode);}}>
   <div className="study-inline-fields">{subjectEdit&&<button type="button" aria-label="과목 기호 변경" aria-expanded={symbols} onClick={()=>setSymbols(!symbols)} className="study-symbol study-symbol-trigger">{icon||'없음'}</button>}<input autoFocus aria-label={mode==='add'?'새 하위 목차 이름':'이름'} placeholder={mode==='add'?(type==='chapter'?'새 단원 이름':'새 하위 폴더 이름'):'이름'} value={title} onChange={e=>setTitle(e.target.value)}/></div>
   {subjectEdit&&symbols&&<FolderSymbolPicker value={icon} onChange={setIcon}/>}
   <input className="study-inline-description" aria-label="설명" placeholder="설명 (선택)" value={desc} onChange={e=>setDesc(e.target.value)}/>
   {mode==='add'&&<label className="study-inline-kind">종류<select aria-label="목차 종류" value={type} onChange={e=>setType(e.target.value as 'chapter'|'folder')}><option value="chapter">문제 단원</option><option value="folder">폴더</option></select></label>}
   {!subjectEdit&&<StudyBookCoverInput key={mode} value={coverImage} onChange={setCoverImage} isBook={isBook} onBookChange={setIsBook} onBusyChange={setCoverBusy}/>}
   <footer><button disabled={!title.trim()||coverBusy}>{mode==='add'?'추가하기':'저장'}</button></footer>
  </form>}
  {mode==='move'&&<div><select className="study-inline-destination" aria-label="이동할 목차" value={parent} onChange={e=>setParent(e.target.value)}><option value="">최상위</option>{subjects.filter(s=>!subject||s.id!==id).map(s=><optgroup key={s.id} label={s.name}><option value={'s:'+s.id}>{s.name}</option>{chapters.filter(c=>c.subjectId===s.id&&!excluded.has(c.id)).map(c=><option key={c.id} value={'c:'+c.id}>{chapterPath(c.id,chapters)}</option>)}</optgroup>)}</select><footer><div className="study-inline-order"><button aria-label="위로 이동" onClick={()=>finish('up')}><ArrowUp size={13}/></button><button aria-label="아래로 이동" onClick={()=>finish('down')}><ArrowDown size={13}/></button></div><button onClick={()=>finish('move')}>여기로 이동</button></footer></div>}
  {mode==='delete'&&<div><p>이 항목과 하위 목차·문제를 모두 삭제할까요?</p><footer><button className="study-inline-delete" onClick={()=>finish('delete')}>삭제하기</button></footer></div>}
 </div>;
}
