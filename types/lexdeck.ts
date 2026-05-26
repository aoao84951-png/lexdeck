// types/lexdeck.ts

export type OxAnswer = "O" | "X";

export type Subject = {
  id: string;
  name: string;
};

export type Chapter = {
  id: string;
  subjectId: string;
  parentId: string | null;
  title: string;
  order: number;
};

export type Question = {
  id: string;
  subjectId: string;
  chapterId: string;
  text: string;
  answer: OxAnswer;
  explanation: string;
  memorized: boolean;
  tags: string[];
};