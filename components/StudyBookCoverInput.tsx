"use client";

import {NoCover} from "./StudyBookCover";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

// Keep the thumbnail small because books are synced together in the existing JSON document.
async function readCover(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일을 선택해 주세요.");
  if (file.size > 20 * 1024 * 1024) throw new Error("20MB 이하의 이미지를 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, 360 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 읽지 못했어요. 다시 선택해 주세요.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch (error) {
    if (error instanceof Error && error.message.includes("다시")) throw error;
    throw new Error("이 이미지를 열 수 없어요. JPG 또는 PNG로 다시 선택해 주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function StudyBookCoverInput({ value, onChange, onBusyChange, isBook, onBookChange }: {
  value: string;
  isBook: boolean;
  onBookChange: (value: boolean) => void;
  onChange: (value: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectFile = async (file: File) => {
    const token = ++request.current;
    setBusy(true); onBusyChange?.(true); setError("");
    try {
      const data = await readCover(file);
      if (request.current === token) { onChange(data); onBookChange(true); }
    } catch (error) {
      if (request.current === token) setError(error instanceof Error ? error.message : "이미지를 읽지 못했어요.");
    } finally {
      if (request.current === token) { setBusy(false); onBusyChange?.(false); }
    }
  };
  const openPicker = () => {
    setError("");
    fileInput.current?.click();
  };
  useEffect(() => () => { request.current++; }, []);
  return <div className="space-y-2 px-2 py-1">
    <p className="text-[11px] text-[#737b88]">책 표지 <span className="text-[10px] text-[#939ba5]">선택</span></p>
    <div className="flex items-center gap-3">
      {value ? <NextImage unoptimized width={44} height={64} src={value} alt="선택한 책 표지" className="h-16 w-11 shrink-0 rounded-md object-contain" /> : <NoCover preview />}
      <div className="grid min-w-0 justify-items-stretch gap-1">
        <button type="button" disabled={busy} onClick={openPicker} className="inline-flex min-h-8 items-center justify-center rounded-xl border border-[#e5ddec] bg-white px-3 text-[11px] text-[#867098] focus-visible:outline-2 focus-visible:outline-[#b6a0d5] disabled:opacity-50">
          {busy ? "이미지 준비 중…" : value ? "표지 바꾸기" : "표지 선택"}
        </button>
        <input ref={fileInput} aria-label="책 표지 선택" type="file" accept="image/*" disabled={busy} className="hidden" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void selectFile(file);
        }} />
        {value && <button type="button" disabled={busy} onClick={() => { onChange(""); onBookChange(true); }} className="min-h-8 text-center text-[11px] text-[#87939e]">표지 없애기</button>}
        {!value && <label className="flex min-h-8 items-center justify-center gap-2 text-[11px] text-[#87939e]"><input type="checkbox" checked={isBook} disabled={busy} onChange={event => onBookChange(event.target.checked)} className="h-3 w-3 accent-[#a38cbb]" />표지 없는 책</label>}
      </div>
    </div>

    {error && <p role="alert" className="text-[11px] text-[#b36565]">{error}</p>}
  </div>;
}
