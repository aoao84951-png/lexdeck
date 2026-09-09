"use client";
import {useEffect,useState} from "react";
import { BookOpen } from "lucide-react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Star } from "./StudySymbols";
import {StudySettings} from "./StudyHeader";
import {chapterPath, importance, studyText, type StudySubject, type StudyChapter, type StudyQuestion} from "./studyTypes";
export default function StudyHome({subjects,chapters,questions,onOpen,onContents}:{subjects:StudySubject[];chapters:StudyChapter[];questions:StudyQuestion[];onOpen:(id:string)=>void;onSubject:(id:string)=>void;onContents:()=>void}){
 const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(false),[last,setLast]=useState(''),[statsSubject,setStatsSubject]=useState('');
 useEffect(()=>{const read=()=>{try{setLast(localStorage.getItem('lexdeck-last-question')||'');}catch{}};read();},[]);
 const selectedSubject=subjects.some(subject=>subject.id===statsSubject)?statsSubject:'';
 const statsQuestions=selectedSubject?questions.filter(question=>question.subjectId===selectedSubject):questions;
 const sorted=[...questions].sort((a,b)=>Number(a.memorized)-Number(b.memorized)||importance(b)-importance(a));
 const current=sorted[index%Math.max(1,sorted.length)];const resume=questions.find(q=>q.id===last);
 const location=(q:StudyQuestion)=>[subjects.find(s=>s.id===q.subjectId)?.name,chapterPath(q.chapterId,chapters)].filter(Boolean).join(' → ');
 const resumeTitle=resume?[subjects.find(s=>s.id===resume.subjectId)?.name,chapters.find(c=>c.id===resume.chapterId)?.title].filter(Boolean).join(' · '):'';
 const resumeNumber=resume?questions.filter(q=>q.chapterId===resume.chapterId).findIndex(q=>q.id===resume.id)+1:0;
 const move=(by:number)=>{setIndex(value=>(value+by+sorted.length)%sorted.length);setRevealed(false);};
 return <div className="study-home"><header className="study-home-header"><h1>오늘의 한 문제</h1><StudySettings/></header>
 {current?<><article className="study-daily-card"><div className="study-card-top"><span>{importance(current)>0&&<><Star size={14}/>{importance(current)}</>}</span></div><button aria-label={revealed?'정답 숨기기':'정답 확인하기'} aria-expanded={revealed} className="study-daily-question" onClick={()=>setRevealed(!revealed)}><strong>{studyText(current.textHtml)}</strong>{revealed?<span className="study-daily-answer"><b>{current.answer}</b>{studyText(current.explanationHtml)}</span>:<span>눌러서 정답과 해설 확인하기</span>}</button><p className="study-path">{location(current)}</p></article><div className="study-daily-controls"><button aria-label="이전 추천 문제" disabled={sorted.length<2} onClick={()=>move(-1)}><ChevronLeft size={19}/></button><button onClick={()=>onOpen(current.id)}>문제 자세히 보기<ArrowUpRight size={15}/></button><button aria-label="다음 추천 문제" disabled={sorted.length<2} onClick={()=>move(1)}><ChevronRight size={19}/></button></div></>:<div className="study-empty"><BookOpen size={30}/><p>첫 문제를 담아 공부를 시작해 보세요.</p><button onClick={onContents}>목차 열기</button></div>}
 {resume&&<button className="study-resume" onClick={()=>onOpen(resume.id)}><span><small>이어서 공부하기</small><strong>{resumeTitle}</strong><span className="study-resume-preview">Q{resumeNumber} · {studyText(resume.textHtml)}</span></span><ArrowUpRight size={20}/></button>}
 <section className="study-statistics-section" aria-label="과목별 학습 현황"><div className="study-statistics-header"><h2>학습 현황</h2><div className="study-statistics-filter"><select aria-label="통계 과목 선택" value={selectedSubject} onChange={event=>setStatsSubject(event.target.value)}><option value="">전체 과목</option>{subjects.map(subject=><option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><span aria-hidden="true" className="study-symbol study-statistics-chevron">▽</span></div></div><div className="study-statistics" aria-live="polite"><div><strong>{statsQuestions.length}</strong><span>전체 문제</span></div><div><strong>{statsQuestions.filter(q=>!q.memorized).length}</strong><span>미암기</span></div><div><strong>{statsQuestions.filter(q=>importance(q)>0).length}</strong><span>중요문제</span></div></div></section>

 </div>;
}
