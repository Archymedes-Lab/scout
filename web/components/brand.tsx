// Scout's marks, in Sage's Swiss system: a cobalt square and the name set in the grotesk. Where Sage cuts a quarter from
// the square, Scout pins a point on it: a place found on the grid. It blinks while Scout is working. The icon set (below) keeps a 24px grid, 1.5px stroke.
import type { CSSProperties, SVGProps } from "react";

/** The mark: a cobalt square with a white pin in its upper right, a place marked on the grid. */
export function Mark({ size = 14, pulse = false, className = "" }: { size?: number; pulse?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className={`text-signal ${pulse ? "animate-star" : ""} ${className}`}>
      <rect width="16" height="16" rx="4" fill="currentColor" />
      <rect x="9" y="3" width="4" height="4" fill="var(--on-signal)" />
      <rect x="3" y="11" width="10" height="1.5" fill="var(--on-signal)" opacity="0.55" />
    </svg>
  );
}

/** The wordmark: "Scout" in Inter Tight, tight and medium, after the square. */
export function Wordmark({ height = 16, mark = true, className = "", style }: { height?: number; mark?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span className={`inline-flex items-center gap-[0.45em] font-display font-semibold leading-none tracking-[-0.04em] text-ink ${className}`} style={{ fontSize: height * 1.35, ...style }} role="img" aria-label="Scout">
      {mark && <Mark size={Math.round(height * 0.95)} />}
      <span aria-hidden>Scout</span>
    </span>
  );
}

/** The Archymedes mark: a hairline triangle with a cut and a blue tick. */
export function Archymedes({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3 21 20H3L9.5 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 20h4" stroke="var(--blue)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export type IconName =
  | "arrow" | "arrow-left" | "home" | "search" | "people" | "person" | "pipeline" | "chat" | "spark" | "bulb" | "grid" | "building"
  | "plus" | "close" | "check" | "copy" | "edit" | "trash" | "upload" | "download" | "globe" | "link" | "mail" | "phone" | "refresh"
  | "filter" | "send" | "clock" | "flag" | "history" | "map" | "shield" | "book" | "external" | "more" | "dot" | "chart" | "target" | "wand";

const PATHS: Record<IconName, string> = {
  arrow: "M5 12h14M13 6l6 6-6 6",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  pipeline: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z",
  chat: "M4 5h16v11H9l-5 4z",
  spark: "M12 3v6M12 15v6M3 12h6M15 12h6",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  building: "M4 21V5l8-3v19M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2M2 21h20",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  copy: "M8 8h11v11H8zM5 16V5h11",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  refresh: "M20 11a8 8 0 0 0-14.7-4M4 4v4h4M4 13a8 8 0 0 0 14.7 4M20 20v-4h-4",
  filter: "M4 5h16l-6 8v6l-4-2v-4z",
  send: "M4 12l16-8-6 16-3-7z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  history: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4M12 8v4l3 2",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  dot: "M12 12h.01",
  chart: "M5 19V13M10 19V9M15 19V11M20 19V5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  wand: "M4 20 15 9M14 4v2M18 6l-1.5 1.5M20 10h-2M12 6l2 2",
};

export function Icon({ name, size = 18, strokeWidth = 1.5, className, style, ...rest }:
  { name: IconName; size?: number; strokeWidth?: number; className?: string; style?: CSSProperties } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={{ flex: "none", ...style }} aria-hidden {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
