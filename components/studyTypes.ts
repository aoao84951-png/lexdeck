export type StudySubject = { id: string; name: string; color: string; icon?: string; desc?: string };
export type StudyChapter = { id: string; subjectId: string; parentId: string | null; title: string; type?: "folder" | "chapter"; color?: string; icon?: string; desc?: string };
export type StudyQuestion = { id: string; subjectId: string; chapterId: string; textHtml: string; explanationHtml: string; answer: "O" | "X"; memorized: boolean; importanceStars?: number; favorite?: boolean; extraPoints?: {category: string; title: string; descriptionHtml: string}[] };
export const importance = (q: StudyQuestion) => Math.max(0, Math.min(3, q.importanceStars ?? (q.favorite ? 1 : 0)));
export const studyText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g, " ").trim();
export function chapterPath(id: string, chapters: StudyChapter[]) {
  const result: string[] = [], visited = new Set<string>();
  let chapter = chapters.find(item => item.id === id);
  while (chapter && !visited.has(chapter.id)) { visited.add(chapter.id); result.unshift(chapter.title); chapter = chapters.find(item => item.id === chapter?.parentId); }
  return result.join(" › ");
}
