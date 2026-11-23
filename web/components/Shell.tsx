"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Archymedes, Icon, Wordmark, type IconName } from "./brand";
import { JobDock } from "./Jobs";
import { cx, ToastProvider } from "./ui";
import { useApi } from "@/lib/api";
import type { Health } from "@/lib/types";

// Sage's shell, with Scout's pages: find places and users, then decide.
const NAV: { href: string; label: string; icon: IconName; key: string; group?: string; exact?: boolean }[] = [
  { href: "/", label: "Overview", icon: "home", key: "h", group: "Find", exact: true },
  { href: "/places", label: "Places", icon: "map", key: "p" },
  { href: "/users", label: "Users", icon: "people", key: "u" },
  { href: "/search", label: "Search", icon: "search", key: "s" },
  { href: "/plan", label: "Plan", icon: "target", key: "l", group: "Decide" },
  { href: "/runs", label: "Runs", icon: "history", key: "r" },
];
const TABS = NAV.slice(0, 3);

const isActive = (path: string, n: { href: string; exact?: boolean }) => (n.exact ? path === n.href : path.startsWith(n.href));

function Services() {
  const { data: health } = useApi<Health>("health");
  const services: [string, boolean | undefined, string][] = [
    ["Exa", health?.exa, "Search (EXA_API_KEY in ~/sales/.env)"],
    ["Jev", health?.jev, "Orion's and cdm's judge (TYPESAFE_API_KEY)"],
    ["Orion", health?.orion, "Orion's decision engine (~/orion)"],
    ["cdm", health?.cdm, "Creative decision making (~/creative-decision)"],
  ];
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5" aria-label="Services">
      {services.map(([name, ok, hint]) => (
        <li key={name} title={hint} className="flex items-center gap-2 text-xs text-faint">
          <span className={cx("size-1.5", ok === undefined ? "bg-line" : ok ? "bg-signal" : "bg-danger")} />
          {name}<span className="sr-only">{ok ? "on" : "off"}</span>
        </li>
      ))}
    </ul>
  );
}

/** On the deployed copy: say it is a snapshot, from when, and offer sign-out. */
function Snapshot() {
  const { data } = useApi<Health>("health");
  if (!data?.readOnly) return null;
  return (
    <div className="flex flex-col gap-1 text-xs text-muted">
      <span className="text-ink">Read-only snapshot</span>
      <span>{data.snapshotAt ? new Date(data.snapshotAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}. Searches run in the local app.</span>
      <a href="/api/logout" className="text-faint hover:text-ink">Sign out</a>
    </div>
  );
}

function Rail() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 z-40 hidden h-dvh flex-col border-r border-line bg-white min-[900px]:flex">
      <div className="flex h-16 items-center justify-between border-b-2 border-ink px-5">
        <Link href="/" aria-label="Scout overview"><Wordmark height={13} /></Link>
        <span className="flex items-center gap-1.5 text-faint" title="Archymedes, internal"><Archymedes size={13} /><span className="t-label text-[10px]">Argus-1</span></span>
      </div>
      <nav aria-label="Scout" className="mt-3 flex flex-col">
        {NAV.map((n, i) => (<div key={n.href} className="contents">
          {n.group && <span className={cx("t-label border-t border-line px-5 pb-2 pt-3 text-[10px]", i > 0 && "mt-4")}>{n.group}</span>}
          <Link href={n.href} aria-current={isActive(path, n) ? "page" : undefined}
            className="group relative flex h-9 items-center gap-3 px-5 text-[13.5px] text-muted transition-colors duration-200 hover:bg-frost hover:text-ink aria-[current=page]:bg-signal-soft aria-[current=page]:font-medium aria-[current=page]:text-ink before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-transparent aria-[current=page]:before:bg-signal">
            <Icon name={n.icon} size={16} strokeWidth={1.5} className="text-faint group-hover:text-ink group-aria-[current=page]:text-signal" />
            <span>{n.label}</span>
          </Link>
        </div>))}
      </nav>
      <div className="mt-auto flex flex-col gap-4 border-t border-line p-5">
        <JobDock />
        <Snapshot />
        <Services />
      </div>
    </aside>
  );
}

function MobileBars() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const inMore = !TABS.some((t) => isActive(path, t));
  const tab = "flex h-full flex-1 flex-col items-center justify-center gap-1 text-[11px] text-faint transition-colors aria-[current=page]:text-signal-bright active:text-ink";
  return (
    <>
      <header className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-line bg-white/92 pl-4 pr-1 pt-[env(safe-area-inset-top)] backdrop-blur-lg min-[900px]:hidden">
        <Link href="/" aria-label="Scout overview"><Wordmark height={13} /></Link>
        <Link href="/search" aria-label="Search" className="grid size-11 place-items-center text-muted"><Icon name="search" size={19} /></Link>
      </header>
      <nav aria-label="Scout" className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg min-[900px]:hidden">
        <div className="flex h-[60px] items-stretch">
          {TABS.map((t) => <Link key={t.href} href={t.href} aria-current={isActive(path, t) ? "page" : undefined} className={tab}><Icon name={t.icon} size={21} strokeWidth={1.6} />{t.label}</Link>)}
          <button onClick={() => setMore(true)} aria-current={inMore ? "page" : undefined} aria-expanded={more} className={tab}><Icon name="more" size={21} strokeWidth={2.4} />More</button>
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-[70] min-[900px]:hidden" role="dialog" aria-modal aria-label="More">
          <button aria-label="Close" className="absolute inset-0 bg-[rgb(10_26_51/0.32)] animate-fade" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-white pb-[calc(76px+env(safe-area-inset-bottom))] shadow-2 animate-rise">
            <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
              <span className="t-label text-ink">All of Scout</span>
              <button onClick={() => setMore(false)} className="grid size-10 place-items-center text-muted" aria-label="Close"><Icon name="close" size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-px bg-hair">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={isActive(path, n) ? "page" : undefined}
                  className="flex h-[84px] flex-col items-center justify-center gap-2 bg-white text-[13px] text-text active:bg-frost aria-[current=page]:bg-signal-soft aria-[current=page]:text-ink">
                  <Icon name={n.icon} size={20} className="text-signal-bright" />{n.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-4 px-5 pt-4"><JobDock /><Services /></div>
          </div>
        </div>
      )}
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    let g = false;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if ((t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); const el = document.querySelector<HTMLElement>("[data-page-search]"); if (el) el.focus(); else router.push("/search"); return; }
      // "g" then a letter jumps to a page, as in Sage.
      if (e.key === "g") { g = true; setTimeout(() => (g = false), 900); return; }
      if (g) { const n = NAV.find((x) => x.key === e.key); if (n) { g = false; router.push(n.href); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <ToastProvider>
      <div className="grid min-h-dvh grid-cols-1 min-[900px]:grid-cols-[232px_minmax(0,1fr)]">
        <Suspense fallback={<div className="h-[52px] border-b border-line bg-white min-[900px]:h-dvh min-[900px]:border-b-0 min-[900px]:border-r" />}>
          <Rail />
          <MobileBars />
        </Suspense>
        <main id="main" className="relative isolate min-w-0 pb-[calc(60px+env(safe-area-inset-bottom))] min-[900px]:pb-0">{children}</main>
      </div>
    </ToastProvider>
  );
}

/** The page column on the 12-column grid, with the grid drawn faintly behind it. */
export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cx("relative mx-auto w-full px-4 pb-16 pt-6 sm:px-[clamp(20px,4vw,56px)] sm:pb-24 sm:pt-[clamp(28px,5vh,56px)]", wide ? "max-w-[1360px]" : "max-w-[1120px]")}>
      <GridLines />
      {children}
    </div>
  );
}

export function GridLines() {
  return (
    <div aria-hidden className="grid-lines inset-x-4 sm:inset-x-[clamp(20px,4vw,56px)] max-md:[grid-template-columns:repeat(4,minmax(0,1fr))]">
      {Array.from({ length: 12 }, (_, i) => <i key={i} className={i >= 4 ? "max-md:hidden" : undefined} />)}
    </div>
  );
}
