import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LAW_API_KEY = process.env.LAW_API_KEY!;

const getArray = (value: any) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const extractArticleText = (article: any): string => {
    const lines: string[] = [];
  
    const cleanText = (text: any) => {
        return String(text ?? "")
          .trim()
          // 제118조(대리권의 범위) 제거
          .replace(/^제\s*\d+(?:의\d+)?\s*조\s*\([^)]*\)\s*/g, "")
          // 제118조의2(제목) 제거
          .replace(/^제\s*\d+\s*조의\s*\d+\s*\([^)]*\)\s*/g, "")
          // 제118조 제거
          .replace(/^제\s*\d+(?:의\d+)?\s*조\s*/g, "")
          // 그래도 남은 (대리권의 범위) 제거
          .replace(/^\([^)]*\)\s*/g, "")
          // ①법원은 → ① 법원은
          .replace(/([①②③④⑤⑥⑦⑧⑨⑩])(?=\S)/g, "$1 ")
          .trim();
      };
  
    const articleMainText = cleanText(article?.조문내용);
    if (articleMainText) lines.push(articleMainText);
  
    const paragraphs = article?.항;
    const paragraphList = Array.isArray(paragraphs)
      ? paragraphs
      : paragraphs
      ? [paragraphs]
      : [];
  
    paragraphList.forEach((p: any) => {
      const paragraphText = cleanText(p?.항내용);
  
      if (paragraphText && !lines.includes(paragraphText)) {
        lines.push(paragraphText);
      }
  
      const items = p?.호;
      const itemList = Array.isArray(items) ? items : items ? [items] : [];
  
      itemList.forEach((item: any) => {
        const itemText = cleanText(item?.호내용);
  
        if (itemText && !lines.includes(itemText)) {
          lines.push(itemText);
        }
  
        const subItems = item?.목;
        const subItemList = Array.isArray(subItems)
          ? subItems
          : subItems
          ? [subItems]
          : [];
  
        subItemList.forEach((sub: any) => {
          const subText = cleanText(sub?.목내용);
  
          if (subText && !lines.includes(subText)) {
            lines.push(subText);
          }
        });
      });
    });
  
    return lines.filter(Boolean).join("\n");
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const lawName = searchParams.get("lawName")?.trim();
    const articleNo = searchParams.get("articleNo")?.trim();

    if (!lawName || !articleNo) {
      return NextResponse.json({
        success: false,
        message: "lawName 또는 articleNo 누락",
      });
    }

    // 1. DB 먼저 조회
    const { data: existing } = await supabase
      .from("law_articles")
      .select("*")
      .eq("law_name", lawName)
      .eq("article_no", articleNo)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        article: existing,
      });
    }

    // 2. 법령 검색
    const searchUrl =
      `https://www.law.go.kr/DRF/lawSearch.do?` +
      `OC=${LAW_API_KEY}` +
      `&target=law` +
      `&type=JSON` +
      `&query=${encodeURIComponent(lawName)}` +
      `&display=100`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    const lawList = getArray(searchData?.LawSearch?.law);

    const law =
      lawList.find((item: any) => item.법령명한글 === lawName) ??
      lawList.find((item: any) =>
        String(item.법령명한글 ?? "").includes(lawName)
      );

    if (!law?.법령일련번호) {
      return NextResponse.json({
        success: false,
        message: "법령 검색 실패",
        raw: searchData,
      });
    }

    const mst = law.법령일련번호;
    const lawId = law.법령ID ?? "";

    // 3. 법령 본문 가져오기
    const detailUrl =
      `https://www.law.go.kr/DRF/lawService.do?` +
      `OC=${LAW_API_KEY}` +
      `&target=law` +
      `&type=JSON` +
      `&MST=${mst}`;

    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();

    const rawArticles =
      detailData?.법령?.조문?.조문단위 ??
      detailData?.법령?.조문단위 ??
      [];

    const articles = getArray(rawArticles);

    const rows = articles
      .filter((article: any) => article?.조문번호 && article?.조문내용)
      .map((article: any) => ({
        law_name: lawName,
        law_id: lawId,
        article_no: String(article.조문번호).trim(),
        article_key: `${lawName}-${String(article.조문번호).trim()}`,
        article_title: article.조문제목 || null,
        article_text: extractArticleText(article),
        source_url: `https://www.law.go.kr/법령/${encodeURIComponent(
          lawName
        )}/제${String(article.조문번호).trim()}조`,
      }));

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "조문 저장 대상 없음",
        lawName,
        mst,
        raw: detailData,
      });
    }

    // 4. 중복 제거
    const uniqueRows = Array.from(
      new Map(rows.map((row) => [row.article_key, row])).values()
    );

    // 5. DB 저장
    const { error } = await supabase
      .from("law_articles")
      .upsert(uniqueRows, {
        onConflict: "article_key",
      });

    if (error) {
      return NextResponse.json({
        success: false,
        message: "DB 저장 실패",
        error,
      });
    }

    // 6. 다시 해당 조문 찾기
    const { data: article } = await supabase
      .from("law_articles")
      .select("*")
      .eq("law_name", lawName)
      .eq("article_no", articleNo)
      .maybeSingle();

    if (!article) {
      return NextResponse.json({
        success: false,
        message: "법령은 저장했지만 해당 조문을 찾지 못함",
        lawName,
        articleNo,
        savedCount: uniqueRows.length,
      });
    }

    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "서버 오류",
      error,
    });
  }
}