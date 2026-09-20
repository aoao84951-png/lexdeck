"use client";

import { useEffect } from "react";

// Opt-in observer only: ordinary app visits never load the recorder.
export function InputDiagnostics() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("inputDiagnostic") !== "1") return;
    if (document.getElementById("input-diagnostic-script")) return;
    const script = document.createElement("script");
    script.id = "input-diagnostic-script";
    script.src = "/diagnostics/input-recorder.js";
    document.body.appendChild(script);
  }, []);
  return null;
}
