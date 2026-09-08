// Text offsets survive the span replacements made by execCommand and React updates.
export type EditorSelection = { start: number; end: number };

export function readEditorSelection(field: HTMLElement, range: Range): EditorSelection {
  const before = range.cloneRange();
  before.selectNodeContents(field);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length };
}

export function restoreEditorSelection(field: HTMLElement, bookmark: EditorSelection): Range | null {
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let offset = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const end = offset + (node.textContent?.length ?? 0);
    if (!started && bookmark.start <= end) {
      range.setStart(node, Math.max(0, bookmark.start - offset));
      started = true;
    }
    if (started && bookmark.end <= end) {
      range.setEnd(node, Math.max(0, bookmark.end - offset));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return range;
    }
    offset = end;
  }
  return null;
}

export function selectedEditorColors(field: HTMLElement, range: Range) {
  const bookmark = readEditorSelection(field, range);
  const text = new Set<string>();
  const background = new Set<string>();
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  let offset = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const end = offset + (node.textContent?.length ?? 0);
    if (end > bookmark.start && offset < bookmark.end && node.parentElement) {
      text.add(getComputedStyle(node.parentElement).color);
      let color = 'transparent';
      // The editor's own surface is the default, not a text highlight.
      for (let element: HTMLElement | null = node.parentElement; element && element !== field; element = element.parentElement) {
        const value = getComputedStyle(element).backgroundColor;
        if (value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)') { color = value; break; }
      }
      background.add(color);
    }
    offset = end;
  }
  const textColor = text.size === 1 ? [...text][0] : null;
  return {
    text: textColor === getComputedStyle(field).color ? '#303236' : textColor,
    background: background.size === 1 ? [...background][0] : null,
  };
}

export function paletteColorMatches(current: string | null, color: string) {
  if (!current) return false;
  if (color === 'transparent') return current === 'transparent' || current === 'rgba(0, 0, 0, 0)';
  const hex = color.slice(1);
  const rgb = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
  return current === color || current.replace(/\s/g, '') === `rgb(${rgb.join(',')})`;
}
