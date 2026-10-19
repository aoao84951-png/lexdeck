"use client";

import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,FolderPlus,FilePlus2} from 'lucide-react';
import {MoreHorizontal,Plus} from './StudySymbols';
import StudyTreeActions,{type TreeAction} from './StudyTreeActions';
import {useTreeDrag} from './useTreeDrag';
import {type StudySubject,type StudyChapter,type StudyQuestion} from './studyTypes';

type Props={subjects:StudySubject[];chapters:StudyChapter[];questions:StudyQuestion[];initialSubjectId:string;initialChapterId?:string;onTreeAction:(action:TreeAction)=>void;onChapter:(id:string)=>void;onAddSubject:()=>void};
export default function StudyContents(props:Props){
 const [subjectId,setSubjectId]=useState(props.initialSubjectId);
 const [folderId,setFolderId]=useState<string|null>(()=>{const c=props.chapters.find(c=>c.id===props.initialChapterId);return c&&(c.type==='folder'||props.chapters.some(n=>n.parentId===c.id))?c.id:c?.parentId??null;});
 const [management,setManagement]=useState<{id:string;mode?:TreeAction['kind'];type?:'chapter'|'folder'}|null>(null);
 const root=useRef<HTMLDivElement>(null);
 const subject=props.subjects.find(s=>s.id===subjectId);
 const folder=props.chapters.find(c=>c.id===folderId&&c.subjectId===subject?.id);
 const parentId=folder?.id??null;
 const rows=props.chapters.filter(c=>c.subjectId===subject?.id&&c.parentId===parentId);
 const enter=(id:string,isSubject=false)=>{setManagement(null);if(isSubject){setSubjectId(id);setFolderId(null);}else setFolderId(id);};
 const dragStatus=useTreeDrag(root,true,props.chapters,props.onTreeAction,id=>{if(props.subjects.some(s=>s.id===id))enter(id,true);else enter(id);});
 const manage=(id:string)=>setManagement(value=>value?.id===id?null:{id});
 const actions=(item:StudySubject|StudyChapter,isSubject:boolean)=>management?.id===item.id&&<StudyTreeActions key={`${item.id}-${management.mode}-${management.type}`} id={item.id} subject={isSubject} title={'name' in item?item.name:item.title} icon={item.icon} desc={item.desc} subjects={props.subjects} chapters={props.chapters} subjectId={isSubject?item.id:subjectId} initialMode={management.mode} initialType={management.type} onAction={props.onTreeAction} onClose={()=>setManagement(null)}/>;
 const total=(id:string)=>{const ids=new Set([id]);let size=0;while(size!==ids.size){size=ids.size;props.chapters.forEach(c=>{if(c.parentId&&ids.has(c.parentId))ids.add(c.id);});}return props.questions.filter(q=>ids.has(q.chapterId)).length;};
 const current=folder||subject;
 return <div ref={root} className="study-contents">
 {dragStatus&&<p className="study-help" role="status">{dragStatus}</p>}
 {subject?<>
 <div className="study-contents-breadcrumb"><button onClick={()=>{setManagement(null);if(folder)setFolderId(folder.parentId);else{setSubjectId('');setFolderId(null);}}}><ChevronLeft size={17}/>{folder?(props.chapters.find(c=>c.id===folder.parentId)?.title||subject.name):'과목 목록'}</button><button onClick={()=>{setSubjectId('');setFolderId(null);setManagement(null);}}>전체 과목</button></div>
 <div className="study-contents-heading study-tree-row" {...(folder?{'data-chapter-id':folder.id}:{'data-subject-id':subject.id})}><span className="study-symbol">{current?.icon??'#'}</span><div><h3>{folder?.title||subject.name}</h3>{current?.desc&&<p>{current.desc}</p>}</div><button aria-label={`${folder?.title||subject.name} 관리`} aria-expanded={management?.id===current?.id} onClick={()=>manage(current!.id)}><MoreHorizontal size={20}/></button></div>
 {current&&actions(current,!folder)}
 {folder&&props.questions.some(q=>q.chapterId===folder.id)&&<button className="study-contents-own" onClick={()=>props.onChapter(folder.id)}>이 목차의 문제 보기 <small>{props.questions.filter(q=>q.chapterId===folder.id).length}문제</small><ChevronRight size={16}/></button>}
 <div className="study-contents-list">{rows.map(c=>{const children=props.chapters.filter(n=>n.parentId===c.id),container=c.type==='folder'||children.length>0;return <div className="study-contents-item" key={c.id}><div className="study-tree-row" data-chapter-id={c.id}><button className="study-tree-name" onClick={()=>container?enter(c.id):props.onChapter(c.id)}>{c.icon&&<span className="study-symbol">{c.icon}</span>}<span className="study-contents-label"><span>{c.title}</span>{c.desc&&<small>{c.desc}</small>}</span><small>{container?`${children.length}개 목차 · `:''}{total(c.id)}문제</small>{container&&<ChevronRight size={16}/>}</button><button aria-label={`${c.title} 관리`} aria-expanded={management?.id===c.id} onClick={()=>manage(c.id)}><MoreHorizontal size={19}/></button></div>{actions(c,false)}</div>;})}</div>
 {!rows.length&&<p className="study-empty-text">아직 하위 목차가 없어요. 첫 단원을 추가해 보세요.</p>}
 <div className="study-contents-footer"><button onClick={()=>setManagement({id:current!.id,mode:'add',type:'chapter'})}><FilePlus2 size={18}/>단원 추가</button><button onClick={()=>setManagement({id:current!.id,mode:'add',type:'folder'})}><FolderPlus size={18}/>하위 폴더 추가</button></div>
 </>:<><p className="study-contents-count">{props.subjects.length}개 과목</p><div className="study-contents-list">{props.subjects.map(s=><div className="study-contents-item" key={s.id}><div className="study-tree-row" data-subject-id={s.id}><button className="study-tree-name" onClick={()=>enter(s.id,true)}><span className="study-symbol">{s.icon??'#'}</span><span className="study-contents-label"><span>{s.name}</span><small>{props.chapters.filter(c=>c.subjectId===s.id&&c.parentId===null).length}개 목차{s.desc?` · ${s.desc}`:''}</small></span></button><button aria-label={`${s.name} 관리`} aria-expanded={management?.id===s.id} onClick={()=>manage(s.id)}><MoreHorizontal size={19}/></button></div>{actions(s,true)}</div>)}</div>{!props.subjects.length&&<p className="study-empty-text">첫 과목을 추가하고 OX 문제를 모아 보세요.</p>}<div className="study-contents-footer"><button onClick={props.onAddSubject}><Plus size={18}/>과목 추가</button></div></>}
 </div>;
}
