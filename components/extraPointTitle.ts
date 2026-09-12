export function extraPointTitleHtml(point: { title: string; titleHtml?: string }) {
  return point.titleHtml ?? point.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
