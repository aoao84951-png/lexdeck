// A menu can close after an editor has mounted. Restore the active owner's
// overflow instead of capturing another overlay's temporary scroll lock.
const owners = new Map<symbol, "auto" | "hidden">();
let originalOverflow = "";

export function acquireDocumentOverflow(overflow: "auto" | "hidden") {
  const html = document.documentElement;
  if (!owners.size) originalOverflow = html.style.overflow;
  const owner = Symbol();
  owners.set(owner, overflow);
  html.style.overflow = overflow;

  return () => {
    if (!owners.delete(owner)) return;
    html.style.overflow = Array.from(owners.values()).at(-1) ?? originalOverflow;
  };
}
