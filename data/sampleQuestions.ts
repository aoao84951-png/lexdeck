// data/sampleQuestions.ts

import { Chapter, Question, Subject } from "@/types/lexdeck";

export const subjects: Subject[] = [
  { id: "civil", name: "민법" },
  { id: "constitution", name: "헌법" },
  { id: "criminal", name: "형법" },
];

export const chapters: Chapter[] = [
  { id: "civil-1", subjectId: "civil", parentId: null, title: "제1편 민법총칙", order: 1 },
  { id: "civil-1-1", subjectId: "civil", parentId: "civil-1", title: "제1장 통칙", order: 1 },
  { id: "civil-1-1-1", subjectId: "civil", parentId: "civil-1-1", title: "제1절 법원", order: 1 },
];

export const questions: Question[] = [
  {
    id: "q1",
    subjectId: "civil",
    chapterId: "civil-1-1-1",
    text: "민법 제1조에 규정되어 있는 법원은 법률, 관습법, 판례 그리고 조리이다.",
    answer: "X",
    explanation:
      "민법 제1조는 법률에 규정이 없으면 관습법에 의하고, 관습법이 없으면 조리에 의한다고 규정한다. 판례는 민법 제1조에 명시된 법원이 아니다.",
    memorized: false,
    tags: ["민법 제1조", "법원", "관습법", "조리"],
  },
];