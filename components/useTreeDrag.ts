"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {StudyChapter} from './studyTypes';
import type {TreeAction} from './StudyTreeActions';

// Native, non-passive touch listeners preserve normal scrolling until the hold activates.
export function useTreeDrag(root:RefObject<HTMLElement|null>,enabled:boolean,chapters:StudyChapter[],onMove:(action:TreeAction)=>void,onExpand:(id:string)=>void){
 const latest=useRef({chapters,onMove,onExpand});
 useEffect(()=>{latest.current={chapters,onMove,onExpand};});
 const [status,setStatus]=useState('');
 useEffect(()=>{
  const panel=root.current;if(!enabled||!panel)return;
  let source:HTMLElement|null=null,active=false,startX=0,startY=0,x=0,y=0;
  let timer:ReturnType<typeof setTimeout>|undefined,frame=0,suppressUntil=0;
  let marked:HTMLElement|null=null,drop:TreeAction|null=null,hoverId='',hoverAt=0;
  const excluded=new Set<string>();
  const clearMark=()=>{marked?.removeAttribute('data-drop');marked=null;drop=null;};
  const reset=()=>{clearTimeout(timer);cancelAnimationFrame(frame);source?.removeAttribute('data-dragging');clearMark();source=null;active=false;hoverId='';};
  const locate=()=>{
   clearMark();
   const row=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-chapter-id],[data-subject-id]');
   if(!row||!panel.contains(row)||!source)return;
   const id=row.dataset.chapterId,subject=row.dataset.subjectId;
   if(id&&excluded.has(id))return;
   const target=latest.current.chapters.find(c=>c.id===id);
   const rect=row.getBoundingClientRect(),ratio=(y-rect.top)/rect.height;
   const placement=subject?'inside':ratio<.25?'before':ratio>.75?'after':'inside';
   if(!subject&&!target)return;
   drop={kind:'move',subject:false,id:source.dataset.chapterId!,targetSubjectId:subject||target!.subjectId,parentId:subject?null:placement==='inside'?id!:target!.parentId,...(placement!=='inside'?{relativeId:id,placement}: {})};
   marked=row;row.dataset.drop=placement;
   const nextHover=placement==='inside'?(subject||id!):'';
   if(hoverId!==nextHover){hoverId=nextHover;hoverAt=Date.now();}
   if(hoverId&&Date.now()-hoverAt>650)latest.current.onExpand(hoverId);
  };
  const tick=()=>{
   if(!active)return;
   const scroll=panel.querySelector<HTMLElement>('.study-panel-scroll');
   if(scroll){const rect=scroll.getBoundingClientRect();if(x>=rect.left&&x<=rect.right){const speed=y<rect.top+48?-Math.min(12,(rect.top+48-y)/4):y>rect.bottom-48?Math.min(12,(y-rect.bottom+48)/4):0;scroll.scrollTop+=speed;}}
   locate();frame=requestAnimationFrame(tick);
  };
  const begin=(target:EventTarget|null,px:number,py:number)=>{
   reset();
   const name=(target as HTMLElement).closest('.study-tree-name');
   source=name?.closest<HTMLElement>('[data-chapter-id]')||null;
   if(!source)return;
   startX=x=px;startY=y=py;
   timer=setTimeout(()=>{
    if(!source)return;
    excluded.clear();excluded.add(source.dataset.chapterId!);
    let size=0;while(size!==excluded.size){size=excluded.size;latest.current.chapters.forEach(c=>{if(c.parentId&&excluded.has(c.parentId))excluded.add(c.id);});}
    active=true;source.dataset.dragging='true';suppressUntil=Date.now()+1000;
    window.getSelection()?.removeAllRanges();
    setStatus('이동 중 · 원하는 위치에 놓으세요 · Esc로 취소');tick();
   },450);
  };
  const move=(event:Event,px:number,py:number)=>{x=px;y=py;if(active){if(event.cancelable)event.preventDefault();}else if(Math.hypot(x-startX,y-startY)>8)reset();};
  const finish=(cancel=false)=>{const action=active&&!cancel?drop:null;const wasActive=active;if(active)suppressUntil=Date.now()+800;reset();if(action){latest.current.onMove(action);if(action.parentId)latest.current.onExpand(action.parentId);else if(action.targetSubjectId)latest.current.onExpand(action.targetSubjectId);setStatus('목차와 하위 목차를 함께 이동했어요.');}else if(wasActive)setStatus('이동을 취소했어요.');};
  const touchStart=(e:TouchEvent)=>{if(e.touches.length!==1){finish(true);return;}begin(e.target,e.touches[0].clientX,e.touches[0].clientY);};
  const touchMove=(e:TouchEvent)=>{if(e.touches.length!==1){finish(true);return;}move(e,e.touches[0].clientX,e.touches[0].clientY);};
  const touchEnd=()=>finish();const cancel=()=>finish(true);
  const pointerDown=(e:PointerEvent)=>{if(e.pointerType!=='touch'&&e.button===0)begin(e.target,e.clientX,e.clientY);};
  const pointerMove=(e:PointerEvent)=>{if(e.pointerType!=='touch')move(e,e.clientX,e.clientY);};
  const pointerUp=(e:PointerEvent)=>{if(e.pointerType!=='touch')finish();};
  const click=(e:MouseEvent)=>{if(active||Date.now()<suppressUntil){e.preventDefault();e.stopPropagation();}};
  const context=(e:Event)=>{if(source)e.preventDefault();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel();};
  panel.addEventListener('touchstart',touchStart,{passive:true});
  document.addEventListener('touchmove',touchMove,{passive:false});
  document.addEventListener('touchend',touchEnd);document.addEventListener('touchcancel',cancel);
  panel.addEventListener('pointerdown',pointerDown);document.addEventListener('pointermove',pointerMove);document.addEventListener('pointerup',pointerUp);
  panel.addEventListener('click',click,true);panel.addEventListener('contextmenu',context);panel.addEventListener('dragstart',context);
  document.addEventListener('keydown',key);window.addEventListener('blur',cancel);
  return()=>{reset();panel.removeEventListener('touchstart',touchStart);document.removeEventListener('touchmove',touchMove);document.removeEventListener('touchend',touchEnd);document.removeEventListener('touchcancel',cancel);panel.removeEventListener('pointerdown',pointerDown);document.removeEventListener('pointermove',pointerMove);document.removeEventListener('pointerup',pointerUp);panel.removeEventListener('click',click,true);panel.removeEventListener('contextmenu',context);panel.removeEventListener('dragstart',context);document.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);};
 },[enabled,root]);
 return status;
}
