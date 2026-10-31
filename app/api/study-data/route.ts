import { NextRequest, NextResponse } from "next/server";
import { database } from "@/app/lib/firebase-admin";
import { decodeState, encodeState, validStudyData } from "@/app/lib/firebase-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  try {
    const snapshot = await database().doc("study_state/current").get();
    if (!snapshot.exists) throw new Error("이전된 학습 데이터가 없습니다.");
    return NextResponse.json({ data: decodeState(snapshot.data()!), revision: snapshot.get("revision") }, { headers });
  } catch (error) {
    console.error("Study data load failed", error);
    return NextResponse.json({ error: "데이터를 불러오지 못했습니다. 새로고침해 주세요." }, { status: 503, headers });
  }
}
export async function PUT(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    const { data, revision } = await request.json();
    if (!validStudyData(data) || !Number.isSafeInteger(revision) || revision < 1) return NextResponse.json({ error: "잘못된 저장 데이터입니다." }, { status: 400 });
    const encoded = encodeState(data);
    const db = database();
    const ref = db.doc("study_state/current");
    await db.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      if (!current.exists || current.get("revision") !== revision) throw new Error("CONFLICT");
      transaction.update(ref, { ...encoded, revision: revision + 1, updatedAt: new Date().toISOString() });
    });
    return NextResponse.json({ revision: revision + 1 }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") return NextResponse.json({ error: "다른 창에서 데이터가 변경되었습니다. 변경 내용을 복사한 뒤 새로고침해 주세요." }, { status: 409, headers });
    console.error("Study data save failed", error);
    return NextResponse.json({ error: "저장에 실패했습니다. 이 창을 닫지 말고 변경 내용을 보관해 주세요." }, { status: 503, headers });
  }
}
