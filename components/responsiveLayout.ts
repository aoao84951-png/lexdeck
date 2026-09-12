// Keep the matching media queries in app/globals.css in sync.
// Split desktop windows should retain the desktop study and editor controls.
export const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

export function isMobileLayout() {
  return !window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}
