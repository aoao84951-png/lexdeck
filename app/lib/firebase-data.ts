import "server-only";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { database } from "./firebase-admin";

export type StudyData = { subjects: unknown[]; chapters: unknown[]; questions: unknown[] };
export function validStudyData(value: unknown): value is StudyData {
  if (!value || typeof value !== "object") return false;
  const data = value as StudyData;
  return [data.subjects, data.chapters, data.questions].every(items =>
    Array.isArray(items) && items.every(item => item && typeof item === "object" && "id" in item && typeof item.id === "string"));
}
export function encodeState(data: StudyData) {
  const json = JSON.stringify(data);
  const compressed = gzipSync(json);
  if (compressed.length > 900_000) throw new Error("저장 용량을 초과했습니다. 기존 데이터는 유지됩니다.");
  return { compressed, sha256: createHash("sha256").update(json).digest("hex") };
}
export function decodeState(data: FirebaseFirestore.DocumentData): StudyData {
  const json = gunzipSync(data.compressed).toString("utf8");
  if (createHash("sha256").update(json).digest("hex") !== data.sha256) throw new Error("저장 데이터 검증 실패");
  const parsed = JSON.parse(json);
  if (!validStudyData(parsed)) throw new Error("저장 데이터 형식 오류");
  return parsed;
}
export const lawId = (key: string) => createHash("sha256").update(key).digest("hex");
export async function findLaw(lawName: string, articleNo: string) {
  const snapshot = await database().collection("law_articles").where("law_name", "==", lawName).where("article_no", "==", articleNo).limit(1).get();
  return snapshot.empty ? null : JSON.parse(snapshot.docs[0].get("json"));
}
export async function upsertLaws(rows: Record<string, unknown>[]) {
  const db = database();
  for (let offset = 0; offset < rows.length; offset += 400) {
    const chunk = rows.slice(offset, offset + 400);
    const refs = chunk.map(row => db.collection("law_articles").doc(lawId(String(row.article_key))));
    const existing = await db.getAll(...refs);
    const batch = db.batch();
    chunk.forEach((row, index) => {
      const previous = existing[index].exists ? JSON.parse(existing[index].get("json")) : {};
      const merged = { ...previous, ...row };
      batch.set(refs[index], { json: JSON.stringify(merged), law_name: row.law_name, article_no: row.article_no, article_key: row.article_key });
    });
    await batch.commit();
  }
}
