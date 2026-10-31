"use client";
export function StudyStorageStatus({ error }: { error?: string }) {
  return <div role={error ? "alert" : "status"} className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-white p-8 text-center text-[#303236]">
    <p>{error || "학습 데이터를 불러오는 중입니다…"}</p>
    {error && <>
      <p>저장을 중단했습니다. 보관된 변경 내용을 먼저 내려받아 주세요.</p>
      <button type="button" onClick={() => {
        const saved = localStorage.getItem("gonglog-unsaved-study-data");
        if (!saved) return;
        const url = URL.createObjectURL(new Blob([saved], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "gonglog-recovery.json"; link.click();
        URL.revokeObjectURL(url);
      }}>변경 내용 내려받기</button>
      <button type="button" onClick={() => {
        if (localStorage.getItem("gonglog-unsaved-study-data") && !window.confirm("변경 내용을 내려받으셨나요? 계속하면 이 기기의 임시 변경 내용을 지우고 서버 데이터를 불러옵니다.")) return;
        localStorage.removeItem("gonglog-unsaved-study-data");
        window.location.reload();
      }}>서버 데이터 다시 불러오기</button>
    </>}
  </div>;
}
