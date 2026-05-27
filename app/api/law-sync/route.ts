import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LAW_API_KEY = process.env.LAW_API_KEY!;

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return JSON.stringify(value);
}

export async function GET() {
  try {
    const lawName = "민법";

    const searchUrl =
      `https://www.law.go.kr/DRF/lawSearch.do?` +
      `OC=${LAW_API_KEY}` +
      `&target=law` +
      `&type=JSON` +
      `&query=${encodeURIComponent(lawName)}` +
      `&display=100`;

    const searchRes = await fetch(searchUrl, { cache: "no-store" });
    const searchData = await searchRes.json();

    const lawList = toArray(searchData?.LawSearch?.law);

    const law = lawList.find((item: any) => {
      const name = String(item?.법령명한글 ?? "").replace(/<[^>]*>/g, "");
      return name === lawName;
    });

    if (!law?.법령일련번호) {
      return NextResponse.json({
        success: false,
        message: "민법 법령일련번호를 찾지 못함",
        raw: searchData,
      });
    }

    const mst = String(law.법령일련번호);
    const lawId = String(law.법령ID ?? "001001");

    const detailUrl =
      `https://www.law.go.kr/DRF/lawService.do?` +
      `OC=${LAW_API_KEY}` +
      `&target=law` +
      `&type=JSON` +
      `&MST=${mst}`;

    const detailRes = await fetch(detailUrl, { cache: "no-store" });
    const detailData = await detailRes.json();

    const actualLawName =
      detailData?.법령?.기본정보?.법령명_한글 ??
      detailData?.법령?.기본정보?.법령명한글;

    if (actualLawName !== lawName) {
      return NextResponse.json({
        success: false,
        message: "가져온 법령이 민법이 아님",
        actualLawName,
        mst,
        raw: detailData,
      });
    }

    const articles = toArray(
      detailData?.법령?.조문?.조문단위 ??
        detailData?.법령?.조문단위
    );

    const rowsMap = new Map<string, any>();

    articles.forEach((article: any) => {
      const articleNo = cleanText(article?.조문번호);
      const branchNo = cleanText(article?.조문가지번호);

      if (!articleNo) return;
      if (article?.조문여부 && article.조문여부 !== "조문") return;

      const articleKey =
        branchNo && branchNo !== "0" && branchNo !== "00"
          ? `${lawName}-${articleNo}의${Number(branchNo)}`
          : `${lawName}-${articleNo}`;

      rowsMap.set(articleKey, {
        law_name: lawName,
        law_id: lawId,
        article_no: articleNo,
        article_key: articleKey,
        article_title: cleanText(article?.조문제목) || null,
        article_text: cleanText(article?.조문내용),
        source_url: `https://www.law.go.kr/법령/${encodeURIComponent(
          lawName
        )}/제${articleNo}조`,
      });
    });

    const rows = Array.from(rowsMap.values()).filter(
      (row) => row.article_no && row.article_text
    );

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "저장할 조문 rows가 0개임",
        mst,
        actualLawName,
        sampleArticle: articles[0],
        raw: detailData,
      });
    }

    const { error } = await supabase
      .from("law_articles")
      .upsert(rows, {
        onConflict: "article_key",
      });

    if (error) {
      return NextResponse.json({
        success: false,
        error,
      });
    }

    return NextResponse.json({
      success: true,
      lawName,
      mst,
      lawId,
      count: rows.length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : error,
    });
  }
}