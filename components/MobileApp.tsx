"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/app/lib/supabase";

type Answer = "O" | "X";
type Screen = "subjects" | "chapters" | "questions" | "detail";

type Subject = {
    id: string;
    name: string;
    color: string;
};

type Chapter = {
    id: string;
    subjectId: string;
    parentId: string | null;
    title: string;
    type?: "folder" | "chapter";
    color?: string;
};

type ExtraPoint = {
  category: string;
  title: string;
  descriptionHtml: string;
};
type Question = {
  id: string;
  subjectId: string;
  chapterId: string;
  textHtml: string;
  answer: Answer;
  explanationHtml: string;
  extraPoints?: ExtraPoint[];
  favorite: boolean;
  memorized: boolean;
  disabledAutoLinks?: string[];
};

type LawArticle = {
    law_name: string;
    article_no: string;
    article_title: string | null;
    article_text: string;
    source_url: string | null;
};

const uid = () => crypto.randomUUID();

const initialSubjects: Subject[] = [];

const initialChapters: Chapter[] = [];
const initialQuestions: Question[] = [];

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const makeAutoLinkKey = (lawName: string, articleNo: string, text: string) =>
    `${lawName}__${articleNo}__${text}`;
  
const stripEditorControls = (html: string) => {
    if (!html) return "";
  
    return html
      .replace(/<button[^>]*data-law-remove="true"[^>]*>[\s\S]*?<\/button>/g, "")
      .replace(/<span[^>]*data-disable-law-link="true"[^>]*>[\s\S]*?<\/span>/g, "")
      .replace(/<span[^>]*data-law-after="true"[^>]*>[\s\S]*?<\/span>/g, "");
  };

  const cleanEditorHtml = (html: string) =>
    stripEditorControls(html)
      .replace(/\u200B/g, "")
      .replace(/\sstyle="[^"]*"/g, "")
      .replace(/\sclass="[^"]*"/g, "");

  const normalizeQuestionHtml = (html: string) =>
  stripEditorControls(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/div>\s*<div[^>]*>/gi, " ")
    .replace(/<\/p>\s*<p[^>]*>/gi, " ")
    .replace(/<\/?(div|p)[^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const unwrapLawAutoLinks = (html: string) => {
    if (!html) return "";
  
    const div = document.createElement("div");
    div.innerHTML = stripEditorControls(html);
  
    div.querySelectorAll(".law-auto-link").forEach((el) => {
      el.replaceWith(document.createTextNode(el.textContent ?? ""));
    });
  
    div.querySelectorAll("[data-law-after]").forEach((el) => {
      el.remove();
    });
  
    return div.innerHTML;
  };
  
  const linkLawText = (html: string, disabledAutoLinks: string[] = []) => {
    if (!html) return "";
  
    const cleanedHtml = stripEditorControls(html);
  
    if (cleanedHtml.includes("data-law-name=")) {
      return cleanedHtml;
    }
  
    return cleanedHtml.replace(
      /([가-힣A-Za-z0-9·ㆍ「」()]{2,40})\s*제\s*(\d+)조/g,
      (match, lawName, articleNo) => {
        const text = `${lawName} 제${articleNo}조`;
        const key = makeAutoLinkKey(lawName, articleNo, text);
  
        if (disabledAutoLinks.includes(key)) return text;
  
        return `<span role="button" data-law-name="${lawName}" data-article-no="${articleNo}" data-auto-link-key="${key}" class="law-auto-link">${text}</span>`;
      }
    );
};

const normalizeSearch = (value: string) =>
    value.replace(/\s+/g, "").toLowerCase();

const highlightKeyword = (text: string, keyword: string) => {
    const cleanKeyword = keyword.replace(/\s+/g, "").trim();
  
    if (!cleanKeyword) return text;
  
    const chars = text.split("");
  
    let normalized = "";
    const indexMap: number[] = [];
  
    chars.forEach((char, index) => {
      if (char !== " ") {
        normalized += char.toLowerCase();
        indexMap.push(index);
      }
    });
  
    const normalizedKeyword = cleanKeyword.toLowerCase();
  
    const matchIndex = normalized.indexOf(normalizedKeyword);
  
    if (matchIndex === -1) {
      return text;
    }
  
    const start = indexMap[matchIndex];
    const end = indexMap[matchIndex + normalizedKeyword.length - 1];
  
    return (
      <>
        {text.slice(0, start)}
  
        <mark className="rounded-[4px] bg-[#fff0a8] px-0.5 text-[#111827]">
          {text.slice(start, end + 1)}
        </mark>
  
        {text.slice(end + 1)}
      </>
    );
  };

export default function MobileApp() {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);

  const [screen, setScreen] = useState<Screen>("subjects");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const [actionChapterId, setActionChapterId] = useState<string | null>(null);
  const [movingChapterId, setMovingChapterId] = useState<string | null>(null);

  const [actionSubjectId, setActionSubjectId] = useState<string | null>(null);

  const subjectLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressSubject = useRef(false);

  const chapterLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressChapter = useRef(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  const [isStandalone, setIsStandalone] = useState(false);

  const [lawModalOpen, setLawModalOpen] = useState(false);
  const [lawArticle, setLawArticle] = useState<LawArticle | null>(null);
  const lawCacheRef = useRef<Record<string, LawArticle>>({});
  const [reloadTick, setReloadTick] = useState(0);

  const loadedRef = useRef(false);
  const STORAGE_KEY = "lexdeck-navigation-state";

  const isHistoryMoving = useRef(false);
  const isFirstHistoryState = useRef(true);

  useEffect(() => {
    const state = {
      screen,
      subjectId,
      chapterId,
      questionId,
      showAnswer,
      search,
      expandedIds,
    };
  
    if (isHistoryMoving.current) {
      isHistoryMoving.current = false;
      return;
    }
  
    if (isFirstHistoryState.current) {
      window.history.replaceState(state, "", window.location.href);
      isFirstHistoryState.current = false;
      return;
    }
  
    window.history.pushState(state, "", window.location.href);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [screen, subjectId, chapterId, questionId, showAnswer, search, expandedIds]);
  
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!state) return;
  
      isHistoryMoving.current = true;
  
      setScreen(state.screen || "subjects");
      setSubjectId(state.subjectId || "");
      setChapterId(state.chapterId || "");
      setQuestionId(state.questionId || "");
      setShowAnswer(state.showAnswer ?? false);
      setSearch(state.search || "");
      setExpandedIds(state.expandedIds || []);
  
      setFormOpen(false);
      setSubjectFormOpen(false);
      setLawModalOpen(false);
      setActionSubjectId(null);
      setActionChapterId(null);
      setMovingChapterId(null);
    };
  
    window.addEventListener("popstate", handlePopState);
  
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
  
    if (!saved) return;
  
    try {
      const state = JSON.parse(saved);
  
      setScreen(state.screen || "subjects");
      setSubjectId(state.subjectId || "");
      setChapterId(state.chapterId || "");
      setQuestionId(state.questionId || "");
      setShowAnswer(state.showAnswer ?? false);
      setSearch(state.search || "");
      setExpandedIds(state.expandedIds || []);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

useEffect(() => {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  setIsStandalone(standalone);
}, []);

useEffect(() => {
    const loadData = async () => {
    const { data, error } = await supabase
      .from("ox_data")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      loadedRef.current = true;
      return;
    }

    if (data?.data) {
      setSubjects(data.data.subjects ?? []);
      setChapters(data.data.chapters ?? []);
      setQuestions(data.data.questions ?? []);
    }

    loadedRef.current = true;
  };

  loadData();
}, [reloadTick]);

useEffect(() => {
  if (!loadedRef.current) return;

  const save = async () => {
    const payload = {
      subjects,
      chapters,
      questions,
    };

    const { data: existing } = await supabase
      .from("ox_data")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("ox_data")
        .update({ data: payload })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("ox_data")
        .insert({ data: payload });
    }
  };

  save();
}, [subjects, chapters, questions]);

  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const selectedChapter = chapters.find((c) => c.id === chapterId);
  const selectedQuestion = questions.find((q) => q.id === questionId);

  const currentFolder = currentParentId
  ? chapters.find((c) => c.id === currentParentId)
  : null;

  const subjectChapters = chapters.filter((c) => c.subjectId === subjectId);
  const visibleChapters = subjectChapters.filter(
    (c) => c.parentId === currentParentId
  );

  const getDescendantChapterIds = (id: string): string[] => {
    const children = chapters.filter((c) => c.parentId === id);
  
    return children.flatMap((child) => [
      child.id,
      ...getDescendantChapterIds(child.id),
    ]);
  };

  const visibleQuestions = useMemo(() => {
    const keyword = normalizeSearch(search);

    return questions.filter((q) => {
      const subject = subjects.find((s) => s.id === q.subjectId);
      const chapter = chapters.find((c) => c.id === q.chapterId);

      const target = [
        subject?.name,
        chapter?.title,
        stripHtml(q.textHtml),
        stripHtml(q.explanationHtml),
        ...(q.extraPoints ?? []).flatMap((point) => [
          point.category,
          point.title,
          point.descriptionHtml,
        ]),
      ]
        .join(" ")
        .toLowerCase();
        
        const normalizedTarget = normalizeSearch(target);

        if (keyword) return normalizedTarget.includes(keyword);

        return q.chapterId === chapterId;
    });
  }, [search, questions, subjects, chapters, chapterId]);

  const groupedQuestions = useMemo(() => {
    return visibleQuestions.reduce((acc, q) => {
      const key = q.chapterId;
  
      if (!acc[key]) acc[key] = [];
      acc[key].push(q);
  
      return acc;
    }, {} as Record<string, Question[]>);
  }, [visibleQuestions]);

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const addSubject = () => {
    setEditingSubjectId(null);
    setSubjectFormOpen(true);
  };

  const addChapter = (parentId: string | null = null) => {
    const title = prompt("목차명을 입력해줘.");
    if (!title?.trim()) return;
  
    const id = uid();
  
    setChapters((prev) => [
      ...prev,
      {
        id,
        subjectId,
        parentId,
        title: title.trim(),
        type: "chapter",
      },
    ]);
  
    if (parentId) {
      setExpandedIds((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]));
    }
  
    setChapterId(id);
    setScreen("chapters");
  };

  const addFolder = (parentId: string | null = null) => {
    setFolderParentId(parentId);
    setFolderFormOpen(true);
  };

  const selectSubject = (id: string) => {
    setSubjectId(id);
    setCurrentParentId(null);
    setChapterId("");
    setSearch("");
    setScreen("chapters");
  };

  const selectChapter = (id: string) => {
    const target = chapters.find((c) => c.id === id);
    const isFolder = target?.type === "folder";
  
    setChapterId(id);
    setSearch("");
    setShowAnswer(false);
  
    if (isFolder) {
      setCurrentParentId(id);
      return;
    }
  
    const first = questions.find((q) => q.chapterId === id);
    if (first) setQuestionId(first.id);
    else setQuestionId("");
  
    setScreen("questions");
  };

  const selectQuestion = (id: string) => {
    setQuestionId(id);
    setShowAnswer(false);
    setScreen("detail");
  };

  const editSubject = (id: string) => {
    setEditingSubjectId(id);
    setSubjectFormOpen(true);
  };
  
  const deleteSubject = (id: string) => {
    if (!confirm("이 과목과 해당 목차, 문제들을 모두 삭제할까?")) return;
  
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setChapters((prev) => prev.filter((c) => c.subjectId !== id));
    setQuestions((prev) => prev.filter((q) => q.subjectId !== id));
  
    if (subjectId === id) {
      const next = subjects.find((s) => s.id !== id);
  
      if (next) {
        setSubjectId(next.id);
        const nextChapter = chapters.find((c) => c.subjectId === next.id);
        if (nextChapter) setChapterId(nextChapter.id);
      }
  
      setScreen("subjects");
    }
  
    setActionSubjectId(null);
  };

  const editChapter = (id: string) => {
    const target = chapters.find((c) => c.id === id);
    if (!target) return;
  
    const title = prompt("목차명을 수정해줘.", target.title);
    if (!title?.trim()) return;
  
    setChapters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title.trim() } : c))
    );
  
    setActionChapterId(null);
  };
  
  const deleteChapter = (id: string) => {
    if (!confirm("이 목차와 하위목차, 해당 문제들을 모두 삭제할까?")) return;
  
    const deleteIds = [id, ...getDescendantChapterIds(id)];
  
    setChapters((prev) => prev.filter((c) => !deleteIds.includes(c.id)));
    setQuestions((prev) => prev.filter((q) => !deleteIds.includes(q.chapterId)));
  
    if (deleteIds.includes(chapterId)) {
      const next = chapters.find(
        (c) => c.subjectId === subjectId && !deleteIds.includes(c.id)
      );
  
      if (next) setChapterId(next.id);
    }
  
    setActionChapterId(null);
  };
  
  const moveChapter = (movingId: string, targetParentId: string | null) => {
    if (movingId === targetParentId) return;
  
    const disabledIds = [movingId, ...getDescendantChapterIds(movingId)];
    if (targetParentId && disabledIds.includes(targetParentId)) return;
  
    setChapters((prev) =>
      prev.map((c) =>
        c.id === movingId ? { ...c, parentId: targetParentId } : c
      )
    );
  
    if (targetParentId) {
      setExpandedIds((prev) =>
        prev.includes(targetParentId) ? prev : [...prev, targetParentId]
      );
    }
  
    setMovingChapterId(null);
    setActionChapterId(null);
  };

  const openNew = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = () => {
    if (!selectedQuestion) return;
    setEditingId(selectedQuestion.id);
    setFormOpen(true);
  };

  const goHome = () => {
    setScreen("subjects");
    setSubjectId("");
    setChapterId("");
    setQuestionId("");
    setShowAnswer(false);
    setSearch("");
    setExpandedIds([]);
  };

  const goBackScreen = () => {
    if (screen === "chapters") {
      if (currentParentId) {
        const current = chapters.find((c) => c.id === currentParentId);
        setCurrentParentId(current?.parentId ?? null);
        setChapterId(current?.parentId ?? "");
        return;
      }
  
      setScreen("subjects");
      return;
    }
  
    if (screen === "questions") setScreen("chapters");
    if (screen === "detail") setScreen("questions");
  };


  const deleteSelectedQuestion = () => {
    if (!selectedQuestion) return;
    if (!confirm("이 문제를 삭제할까?")) return;
  
    const currentIndex = visibleQuestions.findIndex((q) => q.id === selectedQuestion.id);
    const remain = visibleQuestions.filter((q) => q.id !== selectedQuestion.id);
    const nextQuestion = remain[currentIndex] ?? remain[currentIndex - 1];
  
    setQuestions((prev) => prev.filter((q) => q.id !== selectedQuestion.id));
  
    setShowAnswer(false);
  
    if (nextQuestion) {
      setQuestionId(nextQuestion.id);
      setScreen("detail");
    } else {
      setScreen("questions");
    }
  };

  const openLawArticle = async (lawName: string, articleNo: string) => {
    const key = `${lawName}-${articleNo}`;
  
    if (lawCacheRef.current[key]) {
      setLawArticle(lawCacheRef.current[key]);
      setLawModalOpen(true);
      return;
    }
  
    const res = await fetch(
      `/api/law-link?lawName=${encodeURIComponent(lawName)}&articleNo=${encodeURIComponent(articleNo)}`
    );
  
    const data = await res.json();
  
    if (!data.success) {
      alert("조문을 찾지 못했어.");
      return;
    }
  
    lawCacheRef.current[key] = data.article;
  
    setLawArticle(data.article);
    setLawModalOpen(true);
  };

  return (
    <>
    <main className="min-h-[100svh] bg-white text-[#111827]">
        <section className="mx-auto min-h-[100svh] w-full max-w-[430px] bg-white px-5 pb-6 pt-10">
            {isStandalone && (
            <button
                onClick={() => setReloadTick((prev) => prev + 1)}
                className="fixed bottom-16 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-[#e4e8f0] bg-white/90 shadow-[0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur transition active:scale-95"
                aria-label="새로고침"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                    d="M20 11A8 8 0 1 0 17.7 16.7"
                    stroke="#0f2a5f"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                />
                <path
                    d="M20 4V11H13"
                    stroke="#0f2a5f"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                </svg>
            </button>
            )}
        <MobileHeader
          chapterMode={screen === "chapters"}
          addLabel={screen === "detail" ? "수정" : "+ 추가"}
          onHome={screen !== "subjects" ? goHome : undefined}
          onAddFolder={screen === "chapters" ? () => addFolder(currentParentId) : undefined}
          eyebrow={
            screen === "subjects"
              ? "LEXDECK"
              : screen === "chapters"
              ? "SUBJECT"
              : screen === "questions"
              ? selectedSubject?.name ?? "QUESTION"
              : selectedChapter?.title ?? "DETAIL"
          }
          title={
            screen === "subjects"
              ? "정은이의 스터디룸"
              : screen === "chapters"
              ? currentFolder?.title ?? selectedSubject?.name ?? "목차"
              : screen === "questions"
              ? selectedChapter?.title ?? "문제 목록"
              : ""
          }
          showBack={screen !== "subjects"}
          onBack={goBackScreen}
          onAdd={() => {
            if (screen === "subjects") addSubject();
            if (screen === "chapters") addChapter(currentParentId);
            if (screen === "questions") openNew();
            if (screen === "detail") openEdit();
          }}
          onDelete={screen === "detail" ? deleteSelectedQuestion : undefined}
          screenTitleFix={screen === "detail"}
        />

        {screen === "subjects" && (
            <div className="mt-6">
                {subjects.length === 0 ? (
                <Empty text="등록된 과목이 없어." />
                ) : (
                subjects.map((s) => {
               
              return (
                <button
                    key={s.id}
                    onClick={() => {
                        if (didLongPressSubject.current) {
                        didLongPressSubject.current = false;
                        return;
                        }

                        selectSubject(s.id);
                    }}
                    onPointerDown={() => {
                        didLongPressSubject.current = false;

                        subjectLongPressTimer.current = setTimeout(() => {
                        didLongPressSubject.current = true;
                        setActionSubjectId(s.id);
                        }, 450);
                    }}
                    onPointerUp={() => {
                        if (subjectLongPressTimer.current) clearTimeout(subjectLongPressTimer.current);
                        subjectLongPressTimer.current = null;
                    }}
                    onPointerCancel={() => {
                        if (subjectLongPressTimer.current) clearTimeout(subjectLongPressTimer.current);
                        subjectLongPressTimer.current = null;
                    }}
                    onPointerLeave={() => {
                        if (subjectLongPressTimer.current) clearTimeout(subjectLongPressTimer.current);
                        subjectLongPressTimer.current = null;
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setActionSubjectId(s.id);
                    }}
                    className="mb-0 flex h-[50px] w-full touch-none select-none items-center justify-between px-1 text-left active:opacity-60"
                    >
                    <div className="flex items-center gap-3">
                        <FolderIcon color={s.color || "#4b6cb7"} />

                        <div>
                            <p className="text-[15px] font-semibold tracking-[-0.03em] text-[#303236]">
                            {s.name}
                            </p>
                        </div>
                    </div>

                    <span className="text-[19px] font-light text-[#9aa3b2]">›</span>
                </button>
              );
            })
          )}
        </div>
       )}

        {screen === "chapters" && (
            <div className="mt-6">
                {visibleChapters.length === 0 ? (
                <Empty text="등록된 목차가 없어." />
                ) : (
                    <ChapterTree
                        chapters={subjectChapters}
                        rootParentId={currentParentId}
                        selectedId={chapterId}
                        expandedIds={expandedIds}
                        onToggle={(id) =>
                            setExpandedIds((prev) =>
                            prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
                            )
                        }
                        onSelect={selectChapter}
                        onAddChild={addChapter}
                        onOpenAction={setActionChapterId}
                        longPressTimer={chapterLongPressTimer}
                        didLongPress={didLongPressChapter}
                    />
                )}
            </div>
            )}

        {screen === "questions" && (
          <>
            <div className="relative mt-7">
                <SearchIcon />

                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="문제, 해설 검색"
                    className="h-10 w-full rounded-full border border-[#dce2ee] bg-white pl-10 pr-4 text-[12px] outline-none placeholder:text-[#a3abb8]"
                />
            </div>

            <div className="mt-5">
              {visibleQuestions.length === 0 ? (
                <Empty text="등록된 문제가 없어." />
              ) : (
                Object.entries(groupedQuestions).map(([groupChapterId, group]) => {
                    const groupChapter = chapters.find((c) => c.id === groupChapterId);
                  
                    return (
                      <div key={groupChapterId} className="mb-5">
                        <p className="mb-2 mt-5 pl-3 text-[12px] font-bold tracking-[-0.03em] text-[#8a94a6]">
                          {groupChapter?.title ?? "목차 없음"}
                        </p>
                  
                        <div>
                          {group.map((q, i) => (
                            <button
                                key={q.id}
                                onClick={() => selectQuestion(q.id)}
                                className={`mb-3 w-full rounded-[20px] border border-[#e4e8f0] bg-white px-4 py-4 text-left shadow-[0_2px_10px_rgba(15,23,42,0.03)] transition active:scale-[0.995] ${
                                q.memorized ? "opacity-40" : ""
                                }`}
                            >
                              <div>
                                <div>
                                    <div className="mb-2">
                                        <span className="rounded-full bg-[#eef2f8] px-2.5 py-1 text-[10px] font-bold tracking-[0.04em] text-[#0f2a5f]">
                                        Q{i + 1}
                                        </span>
                                    </div>

                                    {search ? (
                                        <p
                                            className={`text-[15px] font-semibold leading-[1.8] tracking-[-0.04em] ${
                                            q.favorite ? "text-[#d95c5c]" : "text-[#111827]"
                                            }`}
                                        >
                                            {highlightKeyword(stripHtml(q.textHtml), search)}
                                        </p>
                                        ) : (
                                            <JustifiedText
                                            className={`text-[15px] font-semibold leading-[1.8] tracking-[-0.04em] ${
                                              q.favorite ? "text-[#d95c5c]" : "text-[#111827]"
                                            }`}
                                            html={linkLawText(normalizeQuestionHtml(q.textHtml), q.disabledAutoLinks ?? [])}
                                          />
                                    )}
                                </div>
                  
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
            </div>
          </>
        )}

        {screen === "detail" && (
          <div className="mt-3">
            <MobileDetail
                question={selectedQuestion}
                questions={visibleQuestions}
                setQuestionId={setQuestionId}
                showAnswer={showAnswer}
                setShowAnswer={setShowAnswer}
                updateQuestion={updateQuestion}
                onEdit={openEdit}
                onOpenLawArticle={openLawArticle}
            />
          </div>
        )}
      </section>

      {actionSubjectId && (
        <SubjectActionSheet
          subject={subjects.find((s) => s.id === actionSubjectId)}
          onClose={() => setActionSubjectId(null)}
          onEdit={() => editSubject(actionSubjectId)}
          onDelete={() => deleteSubject(actionSubjectId)}
        />
      )}

      {actionChapterId && (
        <ChapterActionSheet
            chapter={chapters.find((c) => c.id === actionChapterId)}
            onClose={() => setActionChapterId(null)}
            onAddChild={() => addChapter(actionChapterId)}
            onEdit={() => editChapter(actionChapterId)}
            onMove={() => setMovingChapterId(actionChapterId)}
            onDelete={() => deleteChapter(actionChapterId)}
        />
        )}

        {movingChapterId && (
        <MoveChapterSheet
            chapters={subjectChapters}
            movingId={movingChapterId}
            disabledIds={[movingChapterId, ...getDescendantChapterIds(movingChapterId)]}
            onClose={() => setMovingChapterId(null)}
            onMove={moveChapter}
        />
        )}

      {formOpen && (
        <QuestionForm
          key={editingId ?? "new"}
          question={questions.find((q) => q.id === editingId)}
          defaultSubjectId={subjectId}
          defaultChapterId={chapterId}
          onClose={() => setFormOpen(false)}
          onSave={(saved) => {
            if (editingId) {
              updateQuestion(editingId, saved);
              setQuestionId(editingId);
            } else {
              const id = uid();
              setQuestions((prev) => [
                ...prev,
                {
                  id,
                  subjectId,
                  chapterId,
                  textHtml: saved.textHtml ?? "",
                  answer: saved.answer ?? "O",
                  explanationHtml: saved.explanationHtml ?? "",
                  extraPoints: saved.extraPoints ?? [],
                  favorite: false,
                  memorized: false,
                  disabledAutoLinks: saved.disabledAutoLinks ?? [],
                },
              ]);
              setQuestionId(id);
            }

            setShowAnswer(false);
            setScreen("detail");
            setFormOpen(false);
          }}
        />
      )}
    </main>

    {lawModalOpen && lawArticle && (
        <LawArticleModal
            article={lawArticle}
            onClose={() => setLawModalOpen(false)}
        />
    )}

{subjectFormOpen && (
  <SubjectForm
    subject={subjects.find((s) => s.id === editingSubjectId)}
    onClose={() => {
      setSubjectFormOpen(false);
      setEditingSubjectId(null);
    }}
    onSave={(data) => {
      if (editingSubjectId) {
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === editingSubjectId ? { ...s, ...data } : s
          )
        );
      } else {
        const id = uid();

        setSubjects((prev) => [
          ...prev,
          {
            id,
            name: data.name,
            color: data.color,
          },
        ]);

        setSubjectId(id);
      }

      setSubjectFormOpen(false);
      setEditingSubjectId(null);
    }}
  />
)}

{folderFormOpen && (
  <FolderForm
    onClose={() => {
      setFolderFormOpen(false);
      setFolderParentId(null);
    }}
    onSave={(data) => {
      const id = uid();

      setChapters((prev) => [
        ...prev,
        {
          id,
          subjectId,
          parentId: folderParentId,
          title: data.name,
          type: "folder",
          color: data.color,
        },
      ]);

      if (folderParentId) {
        setExpandedIds((prev) =>
          prev.includes(folderParentId) ? prev : [...prev, folderParentId]
        );
      }

      setCurrentParentId(id);
      setChapterId(id);

      setFolderFormOpen(false);
      setFolderParentId(null);
    }}
  />
)}
</>
);
}


function MobileHeader({
    eyebrow,
    title,
    showBack,
    onBack,
    onAdd,
    addLabel,
    onDelete,
    onHome,
    onAddFolder,
    chapterMode = false,
    screenTitleFix = false,
  }: {
    eyebrow: string;
    title: string;
    showBack: boolean;
    onBack: () => void;
    onAdd: () => void;
    addLabel: string;
    onDelete?: () => void;
    onHome?: () => void;
    onAddFolder?: () => void;
    chapterMode?: boolean;
    screenTitleFix?: boolean;
  }) {
    if (chapterMode) {
        return (
            <header>
            <div className="flex h-4 items-center justify-between">
              <p
                className="text-[12px] font-semibold leading-none tracking-[0.34em] text-[#a3abb8]"
                style={{
                  transform: showBack ? "translateX(3px)" : "translateX(1px)",
                }}
              >
                {eyebrow}
              </p>
          
              {onHome && (
                <button
                  onClick={onHome}
                  className="flex h-4 w-4 items-center justify-center text-[#a3abb8] active:scale-95"
                  aria-label="홈"
                >
                  <HomeIcon size={12} />
                </button>
              )}
            </div>
      
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-0">
                {showBack && (
                  <button
                    onClick={onBack}
                    className="flex h-8 w-8 translate-x-[-10px] translate-y-[2.9px] items-center justify-center text-[#8a94a6]"
                  >
                    <ChevronLeft />
                  </button>
                )}
      
                {title && (
                  <h1 className="translate-x-[0px] translate-y-[3px] truncate text-[20px] font-bold tracking-[-0.06em] text-[#0f2a5f]">
                    {title}
                  </h1>
                )}
              </div>
      
              <div className="flex shrink-0 items-center gap-2">
                {onAddFolder && (
                    <button
                    onClick={onAddFolder}
                    className="relative flex h-[30px] w-[34px] translate-y-[3.5px] items-center justify-center active:scale-95"
                    aria-label="폴더 추가"
                    >
                    <FolderIcon size={18} color="#0f2a5f" />

                    <span className="absolute bottom-[3px] right-[2px] flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-[#0f2a5f] text-white">
                        <span className="translate-y-[-1px] text-[12px] font-bold leading-none">
                            +
                        </span>
                    </span>
                    </button>
                )}

                <button
                    onClick={onAdd}
                    className="flex h-[30px] w-[34px] translate-y-[3.5px] items-center justify-center active:scale-95"
                    aria-label="목차 추가"
                    >
                    <ListAddIcon />
                </button>
              </div>
            </div>
          </header>
        );
      }
  
      return (
        <header>
          <div className="flex h-4 items-center justify-between">
            <p
                className="text-[12px] font-semibold leading-none tracking-[0.34em] text-[#a3abb8]"
                style={{
                transform: showBack ? "translateX(3px)" : "translateX(1px)",
                }}
            >
                {eyebrow}
            </p>

            {onHome && (
                <button
                onClick={onHome}
                className="flex h-4 w-4 items-center justify-center text-[#a3abb8] active:scale-95"
                aria-label="홈"
                >
                <HomeIcon size={12} />
                </button>
            )}
            </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {showBack && (
              <button
                onClick={onBack}
                className="flex h-8 w-6 translate-x-[-6px] translate-y-[3px] items-center justify-center text-[#8a94a6]"
              >
                <ChevronLeft />
              </button>
            )}
  
            {screenTitleFix ? (
                <p className="translate-y-[3px] text-[14px] font-semibold tracking-[0.18em] text-[#a3abb8]">
                    QUESTION
                </p>
                ) : (
                title && (
                    <h1 className="translate-x-[0px] translate-y-[3px] truncate text-[20px] font-bold tracking-[-0.06em] text-[#0f2a5f]">
                    {title}
                    </h1>
                )
            )}
          </div>
  
          <div className="flex shrink-0 items-center gap-0.5">
          {addLabel && (
            <button
                onClick={onAdd}
                className={
                addLabel === "수정"
                    ? "flex h-8 w-8 translate-y-[3px] items-center justify-center text-[#4a4a4a] active:scale-95"
                    : "h-[30px] shrink-0 translate-y-[3.5px] rounded-full bg-[#0f2a5f] px-3 text-[11px] font-semibold text-white active:scale-95"
                }
                aria-label={addLabel}
            >
                {addLabel === "수정" ? <EditIcon /> : addLabel}
            </button>
            )}

            {onDelete && (
            <button
                onClick={onDelete}
                className="flex h-8 w-8 translate-y-[3px] items-center justify-center text-[#c96b6b] active:scale-95"
                aria-label="삭제"
            >
                <TrashIcon />
            </button>
            )}
            </div>
        </div>
      </header>
    );
  }

  function ChapterTree({
    chapters,
    rootParentId,
    selectedId,
    expandedIds,
    onToggle,
    onSelect,
    onOpenAction,
    longPressTimer,
    didLongPress,
  }: {
    chapters: Chapter[];
    rootParentId: string | null;
    selectedId: string;
    expandedIds: string[];
    onToggle: (id: string) => void;
    onSelect: (id: string) => void;
    onAddChild: (parentId: string | null) => void;
    onOpenAction: (id: string) => void;
    longPressTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    didLongPress: React.MutableRefObject<boolean>;
  }) {
    const render = (parentId: string | null, depth: number): ReactNode => {
      return chapters
        .filter((c) => c.parentId === parentId)
        .map((c) => {
          const children = chapters.filter((item) => item.parentId === c.id);
          const hasChildren = children.length > 0;
          const open = expandedIds.includes(c.id);
          const selected = selectedId === c.id;
          const isFolder = c.type === "folder";
          const isTop = depth === 0;
  
          return (
            <div key={c.id}>
              <div
                className={`flex h-[52px] items-center ${
                  isTop ? "" : "border-t border-[#e5e7eb]"
                }`}
                style={{ paddingLeft: 4 + depth * 18 }}
              >
                <button
                  onClick={() => {
                    if (didLongPress.current) {
                      didLongPress.current = false;
                      return;
                    }
                  
                    if (!isFolder && hasChildren) {
                      onToggle(c.id);
                      return;
                    }
                  
                    onSelect(c.id);
                  }}
                  onPointerDown={() => {
                    didLongPress.current = false;
                    longPressTimer.current = setTimeout(() => {
                      didLongPress.current = true;
                      onOpenAction(c.id);
                    }, 450);
                  }}
                  onPointerUp={() => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }}
                  onPointerCancel={() => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }}
                  onPointerLeave={() => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onOpenAction(c.id);
                  }}
                  className={`min-w-0 flex-1 truncate text-left tracking-[-0.03em] ${
                    selected ? "text-[#0f2a5f]" : "text-[#303236]"
                  } ${isFolder ? "text-[15px]" : isTop ? "text-[17px]" : "text-[15px]"} ${
                    isFolder ? "font-semibold" : selected ? "font-bold" : isTop ? "font-semibold" : "font-medium"
                  }`}
                >
                  <span className={isFolder ? "flex min-w-0 items-center gap-3" : "flex min-w-0 items-center gap-2"}>
                    {isFolder && <FolderIcon color={c.color || "#4b6cb7"} />}
  
                    <span className="truncate">{c.title}</span>
                  </span>
                </button>
  
                {hasChildren ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(c.id);
                    }}
                    className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0f2a5f] text-white active:scale-95"
                    aria-label={open ? "접기" : "펼치기"}
                  >
                    <ChevronToggle open={open} />
                  </button>
                ) : (
                  <span className="ml-2 h-7 w-7 shrink-0" />
                )}
              </div>
  
              {hasChildren && open && (
                <div className={isTop ? "border-t border-[#e5e7eb]" : ""}>
                  {render(c.id, depth + 1)}
                </div>
              )}
            </div>
          );
        });
    };
  
    return <div>{render(rootParentId, 0)}</div>;
  }

  function MobileDetail({
    question,
    questions,
    setQuestionId,
    showAnswer,
    setShowAnswer,
    updateQuestion,
    onEdit,
    onOpenLawArticle,
  }: {
    question?: Question;
    questions: Question[];
    setQuestionId: (id: string) => void;
    showAnswer: boolean;
    setShowAnswer: (v: boolean) => void;
    updateQuestion: (id: string, patch: Partial<Question>) => void;
    onEdit: () => void;
    onOpenLawArticle: (lawName: string, articleNo: string) => void;
  }) {
    const detailTapStart = useRef<{ x: number; y: number } | null>(null);
  
    if (!question) return <Empty text="문제를 선택해줘." />;
  
    const currentIndex = questions.findIndex((q) => q.id === question.id);
  
    const goPrev = () => {
        if (currentIndex <= 0) return;
        setQuestionId(questions[currentIndex - 1].id);
    };
      
    const goNext = () => {
        if (currentIndex < 0 || currentIndex >= questions.length - 1) return;
        setQuestionId(questions[currentIndex + 1].id);
    };

    const handleLawClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
      
        const disableButton = target.closest("[data-disable-law-link]") as HTMLElement | null;
      
        if (disableButton) {
          e.stopPropagation();
      
          const key = disableButton.dataset.autoLinkKey;
          if (!key) return;
      
          updateQuestion(question.id, {
            disabledAutoLinks: [
              ...(question.disabledAutoLinks ?? []),
              key,
            ],
          });
      
          return;
        }
      
        const button = target.closest(
        "[data-law-name][data-article-no]"
        ) as HTMLElement | null;
      
        if (!button) return;
      
        e.stopPropagation();
      
        const lawName = button.dataset.lawName;
        const articleNo = button.dataset.articleNo;
      
        if (!lawName || !articleNo) return;
      
        onOpenLawArticle(lawName, articleNo);
    };
  
    return (
      <div
        className="min-h-[calc(100svh-120px)]"
        onPointerDown={(e) => {
          detailTapStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (!detailTapStart.current) return;
  
          const target = e.target as HTMLElement;
  
          if (target.closest("button, a, [data-law-name][data-article-no]")) {
            detailTapStart.current = null;
            return;
          }
  
          const movedX = Math.abs(e.clientX - detailTapStart.current.x);
          const movedY = Math.abs(e.clientY - detailTapStart.current.y);
  
          if (movedX > 10 || movedY > 10) {
            detailTapStart.current = null;
            return;
          }
  
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const third = rect.width / 3;
  
          if (x < third) {
            goPrev();
          } else if (x > third * 2) {
            goNext();
          } else {
            setShowAnswer(!showAnswer);
          }
  
          detailTapStart.current = null;
        }}
      >
        <section className="relative rounded-[22px] border border-[#e4e8f0] bg-white px-5 py-5">
          <div className={question.memorized ? "opacity-40" : ""}>
          <div className="mb-3 flex items-center justify-between">
          <p className="text-[12px] font-bold text-[#8a94a6]">
            Q{currentIndex + 1}.
          </p>
  
            
          </div>
  
          <div className="flex min-h-[72px] items-center justify-center py-3">
            <JustifiedText
                html={linkLawText(
                    normalizeQuestionHtml(question.textHtml),
                    question.disabledAutoLinks ?? []
                )}
                className={`w-full text-[17px] font-bold leading-[1.85] tracking-[-0.05em] ${
                    question.favorite ? "text-[#d95c5c]" : "text-[#111827]"
                }`}
                onClick={handleLawClick}
            />
          </div>
          </div>

          <div className="absolute right-5 top-5 flex gap-1.5">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    updateQuestion(question.id, { favorite: !question.favorite });
                }}
                className={`flex h-7 w-7 items-center justify-center transition-all ${
                    question.favorite
                    ? "text-[#d95c5c]"
                    : "text-[#c7ccd4]"
                }`}
                >
                {question.favorite ? "★" : "☆"}
            </button>

            <button
                type="button"
                onClick={(e) => {
                e.stopPropagation();
                updateQuestion(question.id, { memorized: !question.memorized });
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all ${
                question.memorized
                    ? "border-[#0f2a5f] bg-[#0f2a5f] shadow-[0_6px_14px_rgba(15,42,95,0.22)]"
                    : "border-[#dce2ee] bg-[#f8fafc]"
                }`}
                aria-label="암기완료"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                    d="M5.5 12.5L10 17L18.8 7.5"
                    stroke={question.memorized ? "white" : "#9aa3b2"}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                </svg>
            </button>
            </div>
        </section>
  
        {showAnswer && (
          <section className={`px-5 pb-2 pt-5 ${question.memorized ? "opacity-40" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#8a94a6]">정답</p>
  
              <div
                className={`flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-[14px] font-bold ${
                  question.answer === "O"
                    ? "bg-[#edf7f0] text-[#4d8b63]"
                    : "bg-[#fff0f0] text-[#d95c5c]"
                }`}
              >
                {question.answer}
              </div>
            </div>
  
            <div className="mt-5 h-px bg-[#e5e7eb]" />
  
            <div className="mt-5">
              <p className="mb-3 text-[13px] font-bold text-[#8a94a6]">해설</p>
  
              <JustifiedText
                className="text-[15px] leading-[2.1] tracking-[-0.03em] text-[#303236]"
                html={linkLawText(question.explanationHtml, question.disabledAutoLinks ?? [])}
                onClick={handleLawClick}
              />
              {(question.extraPoints ?? []).length > 0 && (
                <div className="mt-6">
                    <p className="mb-3 pl-[1px] text-[13px] font-bold text-[#8a94a6]">
                    추가 포인트
                    </p>

                    <div className="space-y-3">
                    {(question.extraPoints ?? []).map((point, index) => (
                        <div key={index} className="rounded-2xl bg-[#f5f6fa] px-4 py-3">
                        <div className="-ml-0.5 flex items-center gap-2">
                          {point.category && (
                            <span className="rounded-full bg-[#e7ecf5] px-2 py-1 text-[10px] font-bold text-[#0f2a5f]">
                              {point.category}
                            </span>
                          )}
                      
                          {point.title && (
                            <JustifiedText
                                className="min-w-0 flex-1 text-[13px] font-bold text-[#111827]"
                                html={linkLawText(point.title, question.disabledAutoLinks ?? [])}
                                onClick={handleLawClick}
                            />
                            )}
                        </div>
                      
                        {point.descriptionHtml && (
                          <JustifiedText
                            className="mt-3 text-[13px] leading-[1.8] tracking-[-0.03em] text-[#596275]"
                            html={linkLawText(point.descriptionHtml, question.disabledAutoLinks ?? [])}
                            onClick={handleLawClick}
                           />
                        )}
                      </div>
                    ))}
                    </div>
                </div>
                )}
            </div>
          </section>
        )}
      </div>
    );
  }

  function JustifiedText({
    html,
    className,
    onClick,
  }: {
    html: string;
    className?: string;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  }) {
    return (
      <div
        className={className}
        onClick={onClick}
        style={{
          textAlign: "justify",
          textAlignLast: "left",
          wordBreak: "break-all",
          overflowWrap: "normal",
          whiteSpace: "normal",
        }}
        dangerouslySetInnerHTML={{
          __html: html,
        }}
      />
    );
  }

function QuestionForm({
  question,
  defaultSubjectId,
  defaultChapterId,
  onClose,
  onSave,
}: {
  question?: Question;
  defaultSubjectId: string;
  defaultChapterId: string;
  onClose: () => void;
  onSave: (q: Partial<Question>) => void;
}) {
    const [answer, setAnswer] = useState<Answer>(question?.answer ?? "O");
    const [extraPoints, setExtraPoints] = useState<ExtraPoint[]>(
        question?.extraPoints?.length ? question.extraPoints : []
      );
      const extraPointRefs = useRef<(HTMLDivElement | null)[]>([]);

      const [disabledAutoLinks, setDisabledAutoLinks] = useState<string[]>(
        question?.disabledAutoLinks ?? []
      );
      
      const addExtraPoint = () => {
        setExtraPoints((prev) => [
          ...prev,
          {
            category: "기타",
            title: "",
            descriptionHtml: "",
          },
        ]);
      };
      
      const updateExtraPoint = (
        index: number,
        key: keyof ExtraPoint,
        value: string
      ) => {
        setExtraPoints((prev) =>
          prev.map((point, i) =>
            i === index ? { ...point, [key]: value } : point
          )
        );
      };
      
      const removeExtraPoint = (index: number) => {
        setExtraPoints((prev) => prev.filter((_, i) => i !== index));
      };
    const [customColors, setCustomColors] = useState<string[]>([]);
    
    const textRef = useRef<HTMLDivElement | null>(null);
    const explanationRef = useRef<HTMLDivElement | null>(null);

    const savedSelectionRef = useRef<Range | null>(null);

const saveSelection = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
};

const restoreSelection = () => {
  const selection = window.getSelection();
  const range = savedSelectionRef.current;

  if (!selection || !range) return;

  selection.removeAllRanges();
  selection.addRange(range);
};

  const COLOR_STORAGE_KEY = "lexdeck-custom-colors-v1";

useEffect(() => {
  const saved = localStorage.getItem(COLOR_STORAGE_KEY);
  if (!saved) return;

  try {
    setCustomColors(JSON.parse(saved));
  } catch {
    localStorage.removeItem(COLOR_STORAGE_KEY);
  }
}, []);

const saveCustomColors = (next: string[]) => {
  setCustomColors(next);
  localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(next));
};

const runCommand = (command: string, value?: string) => {
    restoreSelection();
  
    document.execCommand(command, false, value);
  
    savedSelectionRef.current = null;
  };
      
  
  const insertLink = () => {
    const url = prompt("링크 주소를 입력해줘.");
    if (!url) return;
  
    const selection = window.getSelection();
    if (!selection || !selection.toString()) return;
  
    document.execCommand("createLink", false, url);
  
    const anchor = selection.anchorNode?.parentElement?.closest("a");
    if (anchor) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
  };

  const insertLawLink = () => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) {
      alert("법령으로 연결할 글자를 먼저 드래그해줘.");
      return;
    }

    const lawName = prompt("법령명을 입력해줘. 예: 민법, 형법, 변호사법");
    if (!lawName?.trim()) return;

    const articleNo = prompt("조문 번호를 입력해줘. 예: 750");
    if (!articleNo?.trim()) return;

    const selectedText = selection.toString();

    const html = `<span role="button" data-law-name="${lawName.trim()}" data-article-no="${articleNo.trim()}" class="law-auto-link">${selectedText}</span>`;
    document.execCommand("insertHTML", false, html);
  };

  const handleDisableAutoLinkInEditor = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const disableButton = target.closest("[data-disable-law-link]") as HTMLElement | null;
  
    if (!disableButton) return;
  
    e.preventDefault();
    e.stopPropagation();
  
    const key = disableButton.dataset.autoLinkKey;
    if (!key) return;
  
    setDisabledAutoLinks((prev) =>
      prev.includes(key) ? prev : [...prev, key]
    );
  
    const lawLink = disableButton.closest("[data-law-name][data-article-no]") as HTMLElement | null;
    if (!lawLink) return;
  
    const text = lawLink.textContent?.replace("×", "").trim() ?? "";
    lawLink.replaceWith(document.createTextNode(text));
  };

  const unlinkLawLink = () => {
    
    const selection = window.getSelection();
    if (!selection) return;

    const node = selection.anchorNode;
    const element = node instanceof HTMLElement ? node : node?.parentElement;

    const lawButton = element?.closest(
      "[data-law-name][data-article-no]"
    ) as HTMLElement | null;

    if (!lawButton) {
      alert("해제할 법령 링크 안에 커서를 두거나 링크를 선택해줘.");
      return;
    }

    const text = lawButton.textContent ?? "";

    lawButton.replaceWith(document.createTextNode(text));
  };

  const unlinkSelectedAutoLawLink = () => {
    const selection = window.getSelection();
  
    if (!selection || selection.rangeCount === 0) {
      alert("자동링크를 해제할 부분을 드래그해줘.");
      return;
    }
  
    const range = selection.getRangeAt(0);
  
    const container = document.createElement("div");
    container.appendChild(range.cloneContents());
  
    const links = Array.from(
      container.querySelectorAll("[data-auto-link-key]")
    ) as HTMLElement[];
  
    const nextKeys = links
      .map((el) => el.dataset.autoLinkKey)
      .filter(Boolean) as string[];
  
    const selectedText = selection.toString().trim();
  
    const regex =
      /([가-힣A-Za-z0-9·ㆍ「」()]{2,40})\s*제\s*(\d+)조/g;
  
    let match;
  
    while ((match = regex.exec(selectedText)) !== null) {
      const lawName = match[1];
      const articleNo = match[2];
      const text = `${lawName} 제${articleNo}조`;
  
      nextKeys.push(makeAutoLinkKey(lawName, articleNo, text));
    }
  
    if (nextKeys.length === 0) {
      alert("선택한 부분에서 자동링크를 찾지 못했어.");
      return;
    }
  
    setDisabledAutoLinks((prev) =>
      Array.from(new Set([...prev, ...nextKeys]))
    );
  
    // 실제 span 제거
    const selectedLinks = Array.from(
      document.querySelectorAll("[data-auto-link-key]")
    ) as HTMLElement[];
  
    selectedLinks.forEach((el) => {
      const key = el.dataset.autoLinkKey;
  
      if (!key || !nextKeys.includes(key)) return;
  
      const text = el.textContent ?? "";
  
      el.replaceWith(document.createTextNode(text));
    });
  };


  return (
    <div className="fixed inset-0 z-50 bg-black/25 p-4 backdrop-blur-sm">
      <div className="mx-auto flex max-h-[calc(100svh-32px)] max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
          <h2 className="text-[16px] font-bold tracking-[-0.03em]">
            {question ? "문제 수정" : "문제 추가"}
          </h2>

          <button onClick={onClose} className="text-[22px] text-[#8a94a6]">
            ×
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5">

            <Label className="mt-5">OX 지문</Label>
            <EditorToolbar
                runCommand={runCommand}
                insertLink={insertLink}
                insertLawLink={insertLawLink}
                unlinkLawLink={unlinkLawLink}
                customColors={customColors}
                saveCustomColors={saveCustomColors}
                unlinkSelectedAutoLawLink={unlinkSelectedAutoLawLink}
                saveSelection={saveSelection}
            />
            <EditorBox
                refObj={textRef}
                defaultHtml={unwrapLawAutoLinks(question?.textHtml ?? "")}
                placeholder="문제 지문을 입력해줘."
            />

          <Label className="mt-5">정답</Label>
          <div className="flex gap-2">
            {(["O", "X"] as Answer[]).map((v) => (
              <button
                key={v}
                onClick={() => setAnswer(v)}
                className={`h-9 rounded-full px-5 text-[13px] font-bold ${
                  answer === v ? "bg-[#0f2a5f] text-white" : "bg-[#eef2f8] text-[#596275]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <Label className="mt-5">해설</Label>
          <EditorToolbar
            runCommand={runCommand}
            insertLink={insertLink}
            insertLawLink={insertLawLink}
            unlinkLawLink={unlinkLawLink}
            customColors={customColors}
            saveCustomColors={saveCustomColors}
            unlinkSelectedAutoLawLink={unlinkSelectedAutoLawLink}
            saveSelection={saveSelection}
          />
          <EditorBox
            refObj={explanationRef}
            defaultHtml={unwrapLawAutoLinks(question?.explanationHtml ?? "")}
            placeholder="해설을 입력해줘."
          />
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
                <p className="pl-1.5 text-[12px] font-bold text-[#596275]">
                추가 포인트
                </p>

                <button
                type="button"
                onClick={addExtraPoint}
                className="rounded-full bg-[#eef2f8] px-3 py-1.5 text-[11px] font-bold text-[#0f2a5f]"
                >
                + 추가
                </button>
            </div>

            <div className="space-y-3">
                {extraPoints.map((point, index) => (
                <div key={index} className="rounded-2xl border border-[#dce2ee] p-4">
                    <div className="flex gap-2">
                    <input
                        value={point.category}
                        onChange={(e) =>
                        updateExtraPoint(index, "category", e.target.value)
                        }
                        placeholder="유형"
                        className="h-10 flex-1 rounded-xl border border-[#dce2ee] px-3 text-[12px] outline-none"
                    />

                    <button
                        type="button"
                        onClick={() => removeExtraPoint(index)}
                        className="ml-auto h-10 w-10 rounded-xl border border-[#dce2ee] text-[14px] text-[#8a94a6]"
                    >
                        ×
                    </button>
                    </div>

                    <input
                    value={point.title}
                    onChange={(e) => updateExtraPoint(index, "title", e.target.value)}
                    placeholder="제목"
                    className="mt-3 h-11 w-full rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
                    />

                    <div className="mt-2">
                    <EditorToolbar
                        runCommand={runCommand}
                        insertLink={insertLink}
                        insertLawLink={insertLawLink}
                        unlinkLawLink={unlinkLawLink}
                        customColors={customColors}
                        saveCustomColors={saveCustomColors}
                        unlinkSelectedAutoLawLink={unlinkSelectedAutoLawLink}
                        saveSelection={saveSelection}
                    />

                        <EditorBox
                            setRef={(el) => {
                                extraPointRefs.current[index] = el;
                            }}
                            defaultHtml={unwrapLawAutoLinks(point.descriptionHtml)}
                            placeholder="내용"
                            onClick={handleDisableAutoLinkInEditor}
                        />
                    </div>
                </div>
                ))}
            </div>
            </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#e5e7eb] px-5 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-full bg-[#eef2f8] px-5 text-[13px] font-bold text-[#596275]"
          >
            취소
          </button>

          <button
            onClick={() =>
                onSave({
                subjectId: defaultSubjectId,
                chapterId: defaultChapterId,
                answer,
                textHtml: cleanEditorHtml(textRef.current?.innerHTML ?? ""),
                explanationHtml: cleanEditorHtml(explanationRef.current?.innerHTML ?? ""),
                extraPoints: extraPoints
                    .map((point, index) => ({
                        category: point.category.trim(),
                        title: point.title.trim(),
                        descriptionHtml: cleanEditorHtml(
                            extraPointRefs.current[index]?.innerHTML?.trim() ?? ""
                          ),
                    }))
                    .filter((point) => point.title || point.descriptionHtml),
                    disabledAutoLinks,
                })
            }
            className="h-9 rounded-full bg-[#0f2a5f] px-5 text-[13px] font-bold text-white"
            >
            저장
            </button>
        </footer>
      </div>
    </div>
  );
}

function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mb-2 pl-1.5 text-[12px] font-bold text-[#596275] ${className}`}>
      {children}
    </p>
  );
}

function EditorBox({
    refObj,
    setRef,
    defaultHtml,
    placeholder,
    onClick,
  }: {
    refObj?: React.RefObject<HTMLDivElement | null>;
    setRef?: (el: HTMLDivElement | null) => void;
    defaultHtml: string;
    placeholder: string;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  }) {
    const innerRef = useRef<HTMLDivElement | null>(null);
  
    useEffect(() => {
      if (!innerRef.current) return;
      innerRef.current.innerHTML = defaultHtml;
    }, [defaultHtml]);
  
    const insertSoftBreak = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
      
        const range = selection.getRangeAt(0);
        range.deleteContents();
      
        const br = document.createElement("br");
        const spacer = document.createTextNode("\u200B");
      
        range.insertNode(spacer);
        range.insertNode(br);
      
        range.setStartAfter(spacer);
        range.setEndAfter(spacer);
      
        selection.removeAllRanges();
        selection.addRange(range);
    };
  
    return (
      <div
        ref={(el) => {
          innerRef.current = el;
          if (refObj) refObj.current = el;
          setRef?.(el);
        }}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            insertSoftBreak();
          }
        }}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="min-h-[130px] w-full whitespace-pre-wrap rounded-b-[18px] border border-t-0 border-[#dce2ee] bg-white px-4 py-4 text-[14px] leading-[1.9] text-[#303236] outline-none empty:before:text-[#a3abb8] empty:before:content-[attr(data-placeholder)]"
      />
    );
  }

  function EditorToolbar({
    runCommand,
    insertLink,
    insertLawLink,
    unlinkLawLink,
    unlinkSelectedAutoLawLink,
    customColors,
    saveCustomColors,
    saveSelection,
  }: {
    runCommand: (command: string, value?: string) => void;
    insertLink: () => void;
    insertLawLink: () => void;
    unlinkLawLink: () => void;
    unlinkSelectedAutoLawLink: () => void;
    customColors: string[];
    saveCustomColors: (colors: string[]) => void;
    saveSelection: () => void;
  }) {
    const [textPaletteOpen, setTextPaletteOpen] = useState(false);
    const [highlightPaletteOpen, setHighlightPaletteOpen] = useState(false);
  
    const baseColors = ["#e45f5f", "#4778c7", "#f1d466", "#83bd95", "#b79add"];
  
    const addCustomColor = (color: string) => {
        const next = color.trim();
      
        if (!/^#[0-9a-fA-F]{6}$/.test(next)) {
          alert("#000000 형식으로 입력해줘.");
          return;
        }
      
        if (customColors.includes(next)) return;
      
        saveCustomColors([...customColors, next]);
    };
  
    const deleteCustomColor = (color: string) => {
      if (!confirm("이 색상을 삭제할까?")) return;
      saveCustomColors(customColors.filter((item) => item !== color));
    };
  
    return (
      <div className="relative flex min-h-8 flex-wrap items-center gap-1 rounded-t-[16px] border border-[#dce2ee] bg-[#f8fafc] px-2 py-1.5">
        <ToolIcon onClick={() => runCommand("bold")}>B</ToolIcon>
  
        <ToolIcon onClick={() => runCommand("underline")}>
          <span className="underline">U</span>
        </ToolIcon>
  
        <ToolIcon onClick={() => runCommand("italic")}>
          <span className="italic">I</span>
        </ToolIcon>
  
        <ToolIcon onClick={() => runCommand("strikeThrough")}>
          <span className="line-through">S</span>
        </ToolIcon>
  
        <span className="mx-0.5 h-4 w-px bg-[#d7ddea]" />
  
        <div className="relative">
        <ToolIcon
        onClick={() => {
            saveSelection();
            setTextPaletteOpen((prev) => !prev);
            setHighlightPaletteOpen(false);
        }}
        >
            <span className="font-black text-[#22c55e]">C</span>
          </ToolIcon>
  
          {textPaletteOpen && (
            <ColorPalette
                baseColors={baseColors}
                customColors={customColors}
                onNone={() => runCommand("foreColor", "#303236")}
                onPick={(color) => runCommand("foreColor", color)}
                onAdd={addCustomColor}
                onDelete={deleteCustomColor}
                onClose={() => setTextPaletteOpen(false)}
            />
          )}
        </div>
  
        <div className="relative">
          <ToolIcon
            onClick={() => {
                saveSelection();
                setHighlightPaletteOpen((prev) => !prev);
                setTextPaletteOpen(false);
            }}
            >
            <span className="rounded-[3px] bg-[#22c55e] px-1 font-black text-white">
              C
            </span>
          </ToolIcon>
  
          {highlightPaletteOpen && (
            <ColorPalette
                baseColors={baseColors}
                customColors={customColors}
                onNone={() => runCommand("backColor", "transparent")}
                onPick={(color) => runCommand("backColor", color)}
                onAdd={addCustomColor}
                onDelete={deleteCustomColor}
                onClose={() => setHighlightPaletteOpen(false)}
            />
          )}
        </div>
  
        <span className="mx-0.5 h-4 w-px bg-[#d7ddea]" />
  
        <ToolIcon onClick={insertLink}>URL</ToolIcon>
        <ToolIcon onClick={insertLawLink}>법</ToolIcon>
        <ToolIcon onClick={unlinkLawLink}>해제</ToolIcon>
        <ToolIcon onClick={unlinkSelectedAutoLawLink}>자동해제</ToolIcon>
      </div>
    );
  }
  
  function ToolIcon({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="flex h-6 min-w-6 items-center justify-center rounded-[5px] border border-[#cfd6e3] bg-white px-1.5 text-[11px] font-bold text-[#303236] active:bg-[#eef2f8]"
      >
        {children}
      </button>
    );
  }
  
  function ColorPalette({
    baseColors,
    customColors,
    onNone,
    onPick,
    onAdd,
    onDelete,
    onClose,
  }: {
    baseColors: string[];
    customColors: string[];
    onNone: () => void;
    onPick: (color: string) => void;
    onAdd: (color: string) => void;
    onDelete: (color: string) => void;
    onClose: () => void;
  }) {
    const [newColor, setNewColor] = useState("#000000");
    const colors = [...baseColors, ...customColors];
  
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default"
          onClick={onClose}
          aria-label="색상창 닫기"
        />
  
        <div className="absolute left-0 top-8 z-50 w-[220px] rounded-[12px] border border-[#cfd6e3] bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onNone();
                onClose();
              }}
              className="h-6 rounded-md border border-[#dce2ee] px-2 text-[10px] font-bold text-[#596275]"
            >
              없음
            </button>
  
            {colors.map((color) => {
                const isCustom = customColors.includes(color);

                return (
                    <div key={color} className="relative">
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            onPick(color);
                            onClose();
                    }}
                        className="h-6 w-6 rounded-[6px] border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
                        style={{ backgroundColor: color }}
                        title={color}
                    />

                    {isCustom && (
                        <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(color);
                        }}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#111827] text-[9px] font-bold leading-none text-white"
                        aria-label="색상 삭제"
                        >
                        ×
                        </button>
                    )}
                    </div>
                );
                })}
          </div>
  
          <div className="mt-3 flex items-center gap-1.5">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-7 w-8 rounded-md border border-[#dce2ee] bg-white"
            />
  
            <input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="#000000"
              maxLength={7}
              className="h-7 min-w-0 flex-1 rounded-md border border-[#dce2ee] px-2 text-[11px] font-bold text-[#596275] outline-none"
            />
  
            <button
              type="button"
              onClick={() => onAdd(newColor)}
              className="h-7 rounded-md bg-[#0f2a5f] px-2 text-[10px] font-bold text-white"
            >
              추가
            </button>
          </div>
  
        </div>
      </>
    );
  }



function Empty({ text }: { text: string }) {
  return (
    <div className="mt-8 rounded-[22px] border border-dashed border-[#dce2ee] p-8 text-center text-[13px] text-[#8a94a6]">
      {text}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 6L9 12L15 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronToggle({ open }: { open: boolean }) {
    return (
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        className={`transition-transform ${open ? "rotate-180" : ""}`}
      >
        <path
          d="M6 9L12 15L18 9"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

function SubjectActionSheet({
    subject,
    onClose,
    onEdit,
    onDelete,
  }: {
    subject?: Subject;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) {
    if (!subject) return null;
  
    return (
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-end bg-black/25">
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
        >
          <p className="text-[16px] font-bold tracking-[-0.03em] text-[#111827]">
            {subject.name}
          </p>
  
          <div className="mt-5 space-y-2">
            <button
              onClick={onEdit}
              className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
            >
              과목 수정
            </button>
  
            <button
              onClick={onDelete}
              className="h-12 w-full rounded-2xl bg-[#fdeeee] text-[13px] font-bold text-[#b42318]"
            >
              과목 삭제
            </button>
  
            <button
              onClick={onClose}
              className="h-12 w-full rounded-2xl border border-[#dce2ee] text-[13px] font-bold text-[#596275]"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

function ChapterActionSheet({
    chapter,
    onClose,
    onAddChild,
    onEdit,
    onMove,
    onDelete,
  }: {
    chapter?: Chapter;
    onClose: () => void;
    onAddChild: () => void;
    onEdit: () => void;
    onMove: () => void;
    onDelete: () => void;
  }) {
    if (!chapter) return null;
  
    return (
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-end bg-black/25">
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
        >
          <p className="text-[16px] font-bold tracking-[-0.03em] text-[#111827]">
            {chapter.title}
          </p>
  
          <div className="mt-5 space-y-2">
            <button
              onClick={onAddChild}
              className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
            >
              하위목차 추가
            </button>
  
            <button
              onClick={onEdit}
              className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
            >
              목차 수정
            </button>
  
            <button
              onClick={onMove}
              className="h-12 w-full rounded-2xl bg-[#eef2f8] text-[13px] font-bold text-[#0f2a5f]"
            >
              목차 이동
            </button>
  
            <button
              onClick={onDelete}
              className="h-12 w-full rounded-2xl bg-[#fdeeee] text-[13px] font-bold text-[#b42318]"
            >
              목차 삭제
            </button>
  
            <button
              onClick={onClose}
              className="h-12 w-full rounded-2xl border border-[#dce2ee] text-[13px] font-bold text-[#596275]"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  function MoveChapterSheet({
    chapters,
    movingId,
    disabledIds,
    onClose,
    onMove,
  }: {
    chapters: Chapter[];
    movingId: string;
    disabledIds: string[];
    onClose: () => void;
    onMove: (movingId: string, targetParentId: string | null) => void;
  }) {
    const render = (parentId: string | null, depth: number): ReactNode => {
      return chapters
        .filter((c) => c.parentId === parentId)
        .map((c) => {
          const disabled = disabledIds.includes(c.id);
  
          return (
            <div key={c.id}>
              <button
                disabled={disabled}
                onClick={() => onMove(movingId, c.id)}
                className={`flex h-11 w-full items-center border-b border-[#e5e7eb] text-left text-[14px] font-medium ${
                  disabled ? "text-[#c7ccd4]" : "text-[#303236]"
                }`}
                style={{ paddingLeft: depth * 18 }}
              >
                {c.title}
              </button>
  
              {render(c.id, depth + 1)}
            </div>
          );
        });
    };
  
    return (
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-end bg-black/25">
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto max-h-[75svh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
        >
          <p className="text-[16px] font-bold tracking-[-0.03em] text-[#111827]">
            목차 이동
          </p>
  
          <div className="mt-5">
            <button
              onClick={() => onMove(movingId, null)}
              className="flex h-11 w-full items-center border-y border-[#e5e7eb] text-left text-[14px] font-bold text-[#0f2a5f]"
            >
              최상위 목차로 이동
            </button>
  
            {render(null, 0)}
          </div>
  
          <button
            onClick={onClose}
            className="mt-5 h-12 w-full rounded-2xl border border-[#dce2ee] text-[13px] font-bold text-[#596275]"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  function DeleteXIcon() {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M7.2 7.2L16.8 16.8"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M16.8 7.2L7.2 16.8"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  function FolderForm({
    onClose,
    onSave,
  }: {
    onClose: () => void;
    onSave: (data: { name: string; color: string }) => void;
  }) {
    const presetColors = [
      "#4b6cb7",
      "#9b8bd8",
      "#d98b8b",
      "#83bd95",
      "#f1d466",
      "#6bc7c1",
      "#f29cc0",
      "#8b95a7",
    ];
  
    const [name, setName] = useState("");
    const [color, setColor] = useState("#4b6cb7");
  
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/25">
        <div className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <p className="text-[17px] font-bold tracking-[-0.03em] text-[#111827]">
            폴더 추가
          </p>
  
          <div className="mt-5">
            <p className="mb-2 text-[12px] font-bold text-[#596275]">
              폴더명
            </p>
  
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="폴더명을 입력해줘."
              className="h-11 w-full rounded-2xl border border-[#dce2ee] px-4 text-[14px] outline-none"
            />
          </div>
  
          <div className="mt-5">
            <p className="mb-3 text-[12px] font-bold text-[#596275]">
              색상
            </p>
  
            <div className="flex flex-wrap gap-3">
              {presetColors.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`h-8 w-8 rounded-full transition-all ${
                    color === preset ? "scale-110 ring-2 ring-[#111827]" : ""
                  }`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
  
            <div className="mt-4 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 rounded-xl border border-[#dce2ee]"
              />
  
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
              />
            </div>
          </div>
  
          <div className="mt-6 flex gap-2">
            <button
              onClick={onClose}
              className="h-11 flex-1 rounded-2xl border border-[#dce2ee] text-[13px] font-bold text-[#596275]"
            >
              취소
            </button>
  
            <button
              onClick={() => {
                if (!name.trim()) return;
  
                onSave({
                  name: name.trim(),
                  color,
                });
              }}
              className="h-11 flex-1 rounded-2xl bg-[#0f2a5f] text-[13px] font-bold text-white"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  function SubjectForm({
    subject,
    onClose,
    onSave,
  }: {
    subject?: Subject;
    onClose: () => void;
    onSave: (data: { name: string; color: string }) => void;
  }) {
    const presetColors = [
      "#4b6cb7",
      "#9b8bd8",
      "#d98b8b",
      "#83bd95",
      "#f1d466",
      "#6bc7c1",
      "#f29cc0",
      "#8b95a7",
    ];
  
    const [name, setName] = useState(subject?.name ?? "");
    const [color, setColor] = useState(subject?.color ?? "#4b6cb7");
  
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/25">
        <div className="mx-auto w-full max-w-[430px] rounded-t-[24px] bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <p className="text-[17px] font-bold tracking-[-0.03em] text-[#111827]">
            {subject ? "과목 수정" : "과목 추가"}
          </p>
  
          <div className="mt-5">
            <p className="mb-2 text-[12px] font-bold text-[#596275]">
              과목명
            </p>
  
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="민법"
              className="h-11 w-full rounded-2xl border border-[#dce2ee] px-4 text-[14px] outline-none"
            />
          </div>
  
          <div className="mt-5">
            <p className="mb-3 text-[12px] font-bold text-[#596275]">
              색상
            </p>
  
            <div className="flex flex-wrap gap-3">
              {presetColors.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`h-8 w-8 rounded-full transition-all ${
                    color === preset
                      ? "scale-110 ring-2 ring-[#111827]"
                      : ""
                  }`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
  
            <div className="mt-4 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 rounded-xl border border-[#dce2ee]"
              />
  
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-[#dce2ee] px-3 text-[13px] outline-none"
              />
            </div>
          </div>
  
          <div className="mt-6 flex gap-2">
            <button
              onClick={onClose}
              className="h-11 flex-1 rounded-2xl border border-[#dce2ee] text-[13px] font-bold text-[#596275]"
            >
              취소
            </button>
  
            <button
              onClick={() => {
                if (!name.trim()) return;
  
                onSave({
                  name: name.trim(),
                  color,
                });
              }}
              className="h-11 flex-1 rounded-2xl bg-[#0f2a5f] text-[13px] font-bold text-white"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  function FolderIcon({
    size = 22,
    color = "#e7a3ad",
    filled = true,
    className = "",
  }: {
    size?: number;
    color?: string;
    filled?: boolean;
    className?: string;
  }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
      </svg>
    );
  }

  function ListAddIcon({
    size = 26,
    color = "#0f2a5f",
    className = "",
  }: {
    size?: number;
    color?: string;
    className?: string;
  }) {
    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{
          width: size,
          height: size,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M6 7.5H16"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 12H16"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 16.5H13"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
  
        <span className="absolute bottom-[1px] right-[2px] flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-[#0f2a5f] text-white">
            <span className="translate-y-[-1px] text-[12px] font-bold leading-none">
                +
            </span>
        </span>
      </div>
    );
  }

  function SearchIcon() {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9aa3b2]"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
          stroke="currentColor"
          strokeWidth="2"
        />
  
        <path
          d="M20 20L17 17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  function TrashIcon() {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M4.2 5.2H13.8"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
        <path
          d="M7.2 3.6H10.8"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
        <path
          d="M5.3 5.2L5.9 14.1C5.95 14.85 6.55 15.4 7.3 15.4H10.7C11.45 15.4 12.05 14.85 12.1 14.1L12.7 5.2"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.8 7.4V13"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <path
          d="M10.2 7.4V13"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  function EditIcon() {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M4.8 19.2L8.2 18.4L18 8.6C18.6 8 18.6 7 18 6.4L17.6 6C17 5.4 16 5.4 15.4 6L5.6 15.8L4.8 19.2Z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M14.4 7L17 9.6"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  function HomeIcon({ size = 12 }: { size?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 10.5L12 4L20 10.5"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.7 10.2V20H17.3V10.2"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  function LawArticleModal({
    article,
    onClose,
  }: {
    article: LawArticle;
    onClose: () => void;
  }) {
    return (
      <div
        onClick={onClose}
        className="fixed inset-0 z-[70] flex items-end bg-black/25 backdrop-blur-[2px]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto max-h-[78svh] w-full max-w-[430px] overflow-y-auto rounded-t-[30px] bg-white px-7 pb-[calc(26px+env(safe-area-inset-bottom))] pt-6 shadow-2xl"
        >
          <div className="flex items-start justify-between">
            <span className="ml-1 translate-y-[4px] rounded-full bg-[#4b6cb7] px-3.5 py-1.5 text-[13px] font-extrabold tracking-[-0.03em] text-white shadow-[0_4px_14px_rgba(75,108,183,0.18)]">
              {article.law_name}
            </span>
  
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dce2ee] bg-white text-[22px] leading-none text-[#8a94a6]"
            >
              ×
            </button>
          </div>
  
          <h2 className="mt-5 translate-x-[8px] text-[21px] font-extrabold leading-snug tracking-[-0.06em] text-[#111827]">
            제{article.article_no}조
            {article.article_title ? `(${article.article_title})` : ""}
          </h2>
  
          <div className="mt-6 rounded-[22px] bg-[#f6f7fa] px-5 py-5">
          <div className="space-y-3">
            {article.article_text
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, index) => (
                <p
                    key={index}
                    className="text-[16px] font-medium leading-[1.8] tracking-[-0.04em] text-[#303236]"
                >
                    {line}
                </p>
                ))}
            </div>
          </div>
  
          {article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block text-right text-[13px] font-bold text-[#0f2a5f]"
            >
              국가법령정보센터에서 보기
            </a>
          )}
        </div>
      </div>
    );
  }