import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LAW_API_KEY = process.env.LAW_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LAW_API_KEY) {
  throw new Error("필수 환경변수 누락");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const fetchLawJson = async (url: string) => {
  const urls = [
    url,
    url.replace("https://www.law.go.kr", "http://www.law.go.kr"),
  ];

  const headers = {
    Accept: "application/json,text/plain,*/*",
    "User-Agent": "Mozilla/5.0",
  };

  const errors: any[] = [];

  for (const requestUrl of urls) {
    try {
      const res = await fetch(requestUrl, {
        cache: "no-store",
        headers,
      });

      const text = await res.text();

      try {
        return {
          data: JSON.parse(text),
          status: res.status,
          raw: text,
          usedUrl: requestUrl,
        };
      } catch {
        errors.push({
          url: requestUrl,
          status: res.status,
          raw: text.slice(0, 500),
        });
      }
    } catch (error) {
      errors.push({
        url: requestUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new Error(`LAW_API_JSON_FAILED: ${JSON.stringify(errors)}`);
};

const json = (body: any) =>
  NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

const getArray = (value: any) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getTextValue = (value: any): string => {
  if (value == null) return "";

  if (Array.isArray(value)) {
    return value.map(getTextValue).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    return (
      value._text ??
      value["#text"] ??
      value.__text ??
      value.text ??
      ""
    ).toString();
  }

  return String(value);
};

const normalizeLawName = (value: any) =>
  getTextValue(value)
    .replace(/\s+/g, "")
    .replace(/[「」]/g, "")
    .trim();

const normalizeArticleNo = (value: string) =>
  String(value ?? "")
    .replace(/^제/, "")
    .replace(/조의/g, "의")
    .replace(/조/g, "")
    .replace(/\s+/g, "")
    .replace(/^0+(\d)/, "$1")
    .trim();

const getLawTitle = (item: any) =>
  normalizeLawName(item?.법령명한글 ?? item?.법령명 ?? item?.법령약칭명);

const collectArticleUnits = (value: any): any[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap(collectArticleUnits);
  }

  if (typeof value !== "object") return [];

  const current =
    value.조문번호 || value.조문내용 || value.조문제목 ? [value] : [];

  const children = Object.values(value).flatMap(collectArticleUnits);

  return [...current, ...children];
};

const cleanText = (text: any) => {
  return getTextValue(text)
    .trim()
    .replace(/^제\s*\d+(?:의\d+)?\s*조\s*\([^)]*\)\s*/g, "")
    .replace(/^제\s*\d+\s*조의\s*\d+\s*\([^)]*\)\s*/g, "")
    .replace(/^제\s*\d+(?:의\d+)?\s*조\s*/g, "")
    .replace(/^\([^)]*\)\s*/g, "")
    .replace(/([①②③④⑤⑥⑦⑧⑨⑩])(?=\S)/g, "$1 ")
    .trim();
};

const extractArticleText = (article: any): string => {
  const lines: string[] = [];

  const articleMainText = cleanText(article?.조문내용);
  if (articleMainText) lines.push(articleMainText);

  const paragraphList = getArray(article?.항);

  paragraphList.forEach((p: any) => {
    const paragraphText = cleanText(p?.항내용);

    if (paragraphText && !lines.includes(paragraphText)) {
      lines.push(paragraphText);
    }

    const itemList = getArray(p?.호);

    itemList.forEach((item: any) => {
      const itemText = cleanText(item?.호내용);

      if (itemText && !lines.includes(itemText)) {
        lines.push(itemText);
      }

      const subItemList = getArray(item?.목);

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

const makeArticleNo = (article: any) => {
  const mainNo = normalizeArticleNo(getTextValue(article?.조문번호));

  let subNo = normalizeArticleNo(getTextValue(article?.조문가지번호));

  if (!subNo || subNo === "0") {
    const rawText = [
      getTextValue(article?.조문내용),
      getTextValue(article?.조문제목),
    ].join(" ");

    const match = rawText.match(
      new RegExp(`제\\s*0*${mainNo}\\s*조의\\s*(\\d+)`)
    );

    if (match?.[1]) {
      subNo = normalizeArticleNo(match[1]);
    }
  }

  return subNo && subNo !== "0" ? `${mainNo}의${subNo}` : mainNo;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const lawName = searchParams.get("lawName")?.trim();
    const articleNo = searchParams.get("articleNo")?.trim();

    if (!lawName || !articleNo) {
      return json({
        success: false,
        message: "lawName 또는 articleNo 누락",
      });
    }

    const normalizedLawName = normalizeLawName(lawName);
    const normalizedArticleNo = normalizeArticleNo(articleNo);

    const { data: existing } = await supabase
      .from("law_articles")
      .select("*")
      .eq("law_name", normalizedLawName)
      .eq("article_no", normalizedArticleNo)
      .maybeSingle();

    if (existing) {
      return json({
        success: true,
        article: existing,
      });
    }

    const searchUrl =
      `https://www.law.go.kr/DRF/lawSearch.do?` +
      `OC=${LAW_API_KEY}` +
      `&target=law` +
      `&type=JSON` +
      `&query=${encodeURIComponent(lawName)}` +
      `&display=100`;

    let searchData: any;

    try {
      const result = await fetchLawJson(searchUrl);
      searchData = result.data;
    } catch (error) {
      return json({
        success: false,
        message: "법령 검색 API 호출 실패",
        lawName,
        apiKeyExists: !!LAW_API_KEY,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    const lawList = getArray(searchData?.LawSearch?.law);

    const law =
      lawList.find((item: any) => getLawTitle(item) === normalizedLawName) ??
      lawList.find((item: any) => getLawTitle(item).includes(normalizedLawName));

    if (!law?.법령일련번호) {
      return json({
        success: false,
        message: "법령 검색 실패",
        lawName,
        foundLaws: lawList.map((item: any) => getLawTitle(item)),
      });
    }

    const mst = law.법령일련번호;
    const lawId = law.법령ID ?? "";
    const finalLawName = normalizedLawName;

    const detailUrl =
      `https://www.law.go.kr/DRF/lawService.do?` +
      `OC=${LAW_API_KEY}` +
      `&target=law` +
      `&type=JSON` +
      `&MST=${mst}`;

    let detailData: any;

    try {
      const result = await fetchLawJson(detailUrl);
      detailData = result.data;
    } catch (error) {
      return json({
        success: false,
        message: "법령 상세 API 호출 실패",
        lawName,
        normalizedLawName,
        mst,
        apiKeyExists: !!LAW_API_KEY,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    const articles = collectArticleUnits(detailData?.법령);

    const rows = articles
      .filter((article: any) => {
        const no = makeArticleNo(article);
        const text = extractArticleText(article);
        return no && text;
      })
      .map((article: any) => {
        const madeArticleNo = makeArticleNo(article);

        return {
          law_name: finalLawName,
          law_id: lawId,
          article_no: madeArticleNo,
          article_key: `${finalLawName}-${madeArticleNo}`,
          article_title: getTextValue(article?.조문제목) || null,
          article_text: extractArticleText(article),
          source_url: `https://www.law.go.kr/법령/${encodeURIComponent(
            finalLawName
          )}/제${madeArticleNo.replace("의", "조의")}조`,
        };
      });

    const uniqueRows = Array.from(
      new Map(rows.map((row) => [row.article_key, row])).values()
    );

    if (uniqueRows.length === 0) {
      return json({
        success: false,
        message: "조문 저장 대상 없음",
        lawName,
        normalizedLawName,
        mst,
      });
    }

    const { error } = await supabase
      .from("law_articles")
      .upsert(uniqueRows, {
        onConflict: "article_key",
      });

    if (error) {
      return json({
        success: false,
        message: "DB 저장 실패",
        error,
      });
    }

    const targetArticle = uniqueRows.find(
      (row) => row.article_no === normalizedArticleNo
    );

    if (!targetArticle) {
      return json({
        success: false,
        message: "법령은 저장했지만 해당 조문을 찾지 못함",
        lawName,
        normalizedLawName,
        articleNo,
        normalizedArticleNo,
        pickedLaw: finalLawName,
        savedArticleNos: uniqueRows.map((row) => row.article_no),
        savedCount: uniqueRows.length,
      });
    }

    return json({
      success: true,
      article: targetArticle,
    });
  } catch (error) {
    return json({
      success: false,
      message: "서버 오류",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}