"use client";

import { useState } from "react";

const common = ["#", "♡", "○", "△", "☆", "♥", "●", "▲", "★", "◇", "□", "♧", "♬", "♪", "※", "◎", "◐", "◑", "♤", "♠", "♣", "◆", "■", "▽", "▷", "◁"];
const more = Array.from("←↑→↓↔↕↖↗↘↙⇒⇔•‥…†‡‰′″℃℉ℓ№℡™ΩÅ⅓⅔⅛⅜⅝⅞①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ▣▤▥▦▧▨▩◈☎☏☜☞♀♂♨♩♭\ue00a\ue00b\ue00c\ue00d");

export function FolderSymbol({ symbol = "#" }: { symbol?: string }) {
  if (symbol === "") return null;
  return <span aria-hidden="true" className="study-symbol mr-3 inline-flex w-5 shrink-0 items-center justify-center text-[21px] font-normal text-[#858b94]">{symbol}</span>;
}

export function FolderSymbolPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-[12px] font-medium text-[#737b88]">폴더 기호</legend>
      <div className="grid grid-cols-7 gap-2" role="group" aria-label="폴더 기호 선택">
        <button type="button" aria-label="기호 없음" aria-pressed={value === ""} onClick={() => onChange("")}
          className={`flex h-10 items-center justify-center rounded-xl border text-[12px] ${value === "" ? "border-[#a48942] bg-[#fff9e8] text-[#303236]" : "border-transparent bg-[#f7f7f6] text-[#737b88] hover:bg-[#eeeeed]"}`}
        >없음</button>
        {(expanded ? [...common, ...more] : common).map((symbol) => (
          <button key={symbol} type="button" aria-label={`기호 ${symbol}`} aria-pressed={value === symbol}
            onClick={() => onChange(symbol)}
            className={`study-symbol flex h-10 items-center justify-center rounded-xl border text-[23px] transition-colors ${value === symbol ? "border-[#a48942] bg-[#fff9e8] text-[#303236]" : "border-transparent bg-[#f7f7f6] text-[#737b88] hover:bg-[#eeeeed]"}`}
          >{symbol}</button>
        ))}
      </div>
      <button type="button" onClick={() => setExpanded(!expanded)} className="mt-3 text-[12px] text-[#737b88]">{expanded ? "접기" : "기호 더 보기"}</button>
      <label className="mt-3 flex items-center gap-3 text-[12px] text-[#737b88]">
        직접 입력
        <input aria-label="폴더 기호 직접 입력" value={value} onChange={(event) => onChange(Array.from(event.target.value).slice(0, 1).join(""))} className="study-symbol h-10 w-14 rounded-xl border border-[#e4e8f0] text-center text-[23px] text-[#303236]" />
      </label>
    </fieldset>
  );
}
