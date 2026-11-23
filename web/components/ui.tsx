"use client";
// Sage primitives, Swiss: square controls, hard rules, numbered sections. Cobalt means "next step" (one filled button per
// region), status is written in words, every bar prints its value, irreversible actions are confirmed in words.
import Link from "next/link";
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type ComponentProps, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Icon, Mark, type IconName } from "./brand";
import { Topo, type LandVariant } from "./Topo";
import type { Tone } from "@/lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Buttons ────────────────────────────────────────────────────────
type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "xs" | "sm" | "md" | "lg";
const BTN_BASE = "relative inline-flex items-center justify-center gap-2 rounded-pill font-medium tracking-[-0.005em] whitespace-nowrap isolate select-none transition-[background-color,color,box-shadow] duration-200 ease-expo active:translate-y-px disabled:opacity-40 disabled:pointer-events-none aria-disabled:opacity-40 aria-disabled:pointer-events-none";
const BTN_VARIANT: Record<Variant, string> = {
  primary: "bg-signal text-on-signal hover:bg-signal-hover hover:shadow-glow",
  secondary: "bg-white text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:shadow-[inset_0_0_0_1px_var(--ink)]",
  ghost: "text-text hover:text-ink hover:bg-frost",
  danger: "text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_45%,transparent)] hover:bg-danger-soft",
  quiet: "text-muted hover:text-ink",
};
const BTN_SIZE: Record<Size, string> = { xs: "h-7 px-2.5 text-xs", sm: "h-8 px-3.5 text-[13px]", md: "h-10 px-5 text-sm", lg: "h-12 px-6 text-[15px]" };
export const btn = (variant: Variant = "secondary", size: Size = "md", extra?: string) => cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], extra);

export function Button({ variant = "secondary", size = "md", icon, arrow, pending, className, children, disabled, ...rest }:
  { variant?: Variant; size?: Size; icon?: IconName; arrow?: boolean; pending?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={btn(variant, size, cx("group", className))} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {pending ? <Mark size={size === "lg" ? 16 : 12} pulse className="text-current!" /> : icon && <Icon name={icon} size={size === "xs" || size === "sm" ? 14 : 16} />}
      {children}
      {arrow && <Icon name="arrow" size={16} className="transition-transform duration-300 ease-expo group-hover:translate-x-[3px]" />}
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", icon, arrow, className, children, ...rest }:
  { variant?: Variant; size?: Size; icon?: IconName; arrow?: boolean } & ComponentProps<typeof Link>) {
  return (
    <Link className={btn(variant, size, cx("group", className))} {...rest}>
      {icon && <Icon name={icon} size={size === "xs" || size === "sm" ? 14 : 16} />}
      {children}
      {arrow && <Icon name="arrow" size={16} className="transition-transform duration-300 ease-expo group-hover:translate-x-[3px]" />}
    </Link>
  );
}

/** The posters' round blue arrow. Always labelled. */
export function ArrowButton({ label, small, pending, ...rest }: { label: string; small?: boolean; pending?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="submit" aria-label={label} title={label}
      className={cx("group inline-grid place-items-center flex-none rounded-pill bg-signal text-on-signal transition-[background-color,box-shadow] duration-200 ease-expo hover:bg-signal-hover hover:shadow-glow disabled:bg-frost disabled:text-faint disabled:shadow-none",
        small ? "size-8" : "size-11")} {...rest}>
      {pending ? <Mark size={14} pulse className="text-on-signal!" /> : <Icon name="arrow" size={small ? 16 : 20} strokeWidth={1.8} className="transition-transform duration-300 ease-expo group-hover:translate-x-0.5" />}
    </button>
  );
}

export function IconButton({ icon, label, className, size = 36, ...rest }: { icon: IconName; label: string; size?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} style={{ width: size, height: size }}
      className={cx("inline-grid place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-frost hover:text-ink", className)} {...rest}>
      <Icon name={icon} size={Math.round(size / 2.2)} />
    </button>
  );
}

/** Irreversible actions: press, then confirm in words. Disarms after 4 s. */
export function ConfirmButton({ children, confirm = "Press again to confirm", onConfirm, size = "sm", icon = "trash" }:
  { children: ReactNode; confirm?: string; onConfirm: () => void; size?: Size; icon?: IconName }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <Button variant="danger" size={size} icon={icon} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))} aria-live="polite">
      {armed ? confirm : children}
    </Button>
  );
}

// ── Chips, tags, segmented ─────────────────────────────────────────
export function Chip({ icon, pressed, quiet, className, children, ...rest }: { icon?: IconName; pressed?: boolean; quiet?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-pressed={pressed}
      className={cx("inline-flex items-center gap-2 rounded-pill bg-white text-text shadow-[inset_0_0_0_1px_var(--line)] transition-[background-color,color,box-shadow] duration-200 ease-expo hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--line-strong)]",
        "aria-pressed:bg-ink aria-pressed:text-white aria-pressed:shadow-none",
        quiet ? "h-[28px] px-3 text-[12px]" : "h-9 px-4 text-[13px]", className)} {...rest}>
      {icon && <Icon name={icon} size={quiet ? 13 : 15} className="opacity-85" />}
      {children}
    </button>
  );
}

const TAG_TONE: Record<Tone, string> = {
  neutral: "bg-frost text-muted",
  signal: "bg-signal text-on-signal",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};
export function Tag({ tone = "neutral", plain, children, title }: { tone?: Tone; plain?: boolean; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-pill px-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em]", TAG_TONE[tone],
      !plain && "before:size-[5px] before:bg-current before:content-['']")}>
      {children}
    </span>
  );
}

export function Seg<T extends string>({ value, onChange, options, small, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode }[]; small?: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-pill bg-white p-0.5 shadow-[inset_0_0_0_1px_var(--line)]">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}
          className={cx("text-muted transition-colors duration-200 hover:text-ink rounded-pill aria-pressed:bg-ink aria-pressed:text-white",
            small ? "h-[30px] px-3 text-xs" : "h-9 px-4 text-sm")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Surfaces ───────────────────────────────────────────────────────
export function Glass({ className, strong, children, as: As = "div", ...rest }: { className?: string; strong?: boolean; children: ReactNode; as?: "div" | "section" | "aside" | "form" | "article" } & Record<string, unknown>) {
  return <As className={cx("glass", strong && "glass-strong", className)} {...rest}>{children}</As>;
}

/** Swiss section number: "01 — Next moves", over a hairline. */
export function Index({ n, children, action }: { n?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-t-2 border-ink pt-3">
      {n && <span className="t-num text-[11px] font-medium text-signal">{n}</span>}
      <span className="t-label">{children}</span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

/**
 * Every page opens on the 12-column grid: a hard 2px rule with the index and the page's place in Sage, a very large
 * flush-left grotesk title over nine columns, actions in the last three, and the lead set in the first six.
 */
export function PageHeader({ index, title, lead, actions, land, seed = 7 }: { index: string; title: ReactNode; lead?: ReactNode; actions?: ReactNode; land?: LandVariant; seed?: number }) {
  const [section, ...rest] = index.split(" · ");
  return (
    <header className="grid grid-cols-12 gap-x-6 gap-y-4 pb-8 sm:gap-y-7 sm:pb-16">
      {/* Positioned against <main>, so the blue wash spans the whole work area behind the header. */}
      {land && <div className="sky animate-fade" aria-hidden><Topo variant={land} seed={seed} /></div>}
      <div className="col-span-12 flex items-baseline justify-between gap-4 border-t-2 border-ink pt-3 animate-fade">
        <span className="t-label text-ink">{section}</span>
        {rest.length > 0 && <span className="t-label hidden sm:inline">{rest.join(" · ")}</span>}
      </div>
      <h1 className="t-display col-span-12 text-[clamp(2.25rem,1.2rem+4.4vw,6.25rem)] leading-[0.9] animate-rise lg:col-span-9">{title}</h1>
      {actions && <div className="col-span-12 flex flex-wrap items-center gap-2 animate-fade lg:col-span-3 lg:self-end lg:justify-end">{actions}</div>}
      {lead && <p className="col-span-12 max-w-[60ch] text-[0.975rem] max-sm:line-clamp-3 sm:text-[1.0625rem] leading-relaxed text-muted animate-rise [animation-delay:80ms] md:col-span-8 lg:col-span-6">{lead}</p>}
    </header>
  );
}

/** A labelled bar that prints its value. `band` draws the uncertainty range (0..1). */
export function Meter({ label, value, display, lead, band, hint }: { label: ReactNode; value: number; display: string; lead?: boolean; band?: [number, number]; hint?: string }) {
  const pct = Math.max(0.02, Math.min(1, value)) * 100;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1" title={hint}>
      <span className={cx("truncate text-sm", lead ? "font-medium text-ink" : "text-text")}>{label}</span>
      <span className="t-num text-xs text-muted">{display}</span>
      <span className="relative col-span-2 h-1.5 overflow-hidden bg-frost" role="img" aria-label={`${typeof label === "string" ? label : ""}: ${display}`}>
        {band && <span className="absolute inset-y-0 bg-dawn-light" style={{ left: `${band[0] * 100}%`, width: `${Math.max(0, band[1] - band[0]) * 100}%` }} />}
        <span className={cx("absolute inset-y-0 left-0 origin-left animate-grow", lead ? "bg-signal" : "bg-[color-mix(in_srgb,var(--ink)_38%,transparent)]")} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function Disclosure({ n, title, hint, open, children }: { n?: string; title: ReactNode; hint?: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="group/d border-t border-line" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 font-medium text-ink hover:text-signal-bright [&::-webkit-details-marker]:hidden">
        {n && <span className="t-num w-[22px] text-xs text-faint">{n}</span>}
        <span>{title}</span>
        {hint && <span className="ml-auto text-sm font-normal text-faint">{hint}</span>}
        <span aria-hidden className={cx("relative size-3 flex-none before:absolute before:inset-x-0 before:top-[5.5px] before:h-px before:bg-current after:absolute after:inset-x-0 after:top-[5.5px] after:h-px after:rotate-90 after:bg-current after:transition-transform after:duration-300 group-open/d:after:rotate-0", !hint && "ml-auto")} />
      </summary>
      <div className="animate-rise pb-5 pl-0 sm:pl-[34px]">{children}</div>
    </details>
  );
}

export function Stat({ value, label, sub }: { value: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-ink pt-4">
      <span className="t-display text-[clamp(2rem,1.5rem+2.4vw,3.75rem)] leading-none tabular-nums">{value}</span>
      <span className="max-w-[28ch] text-[13px] leading-snug text-muted">{label}</span>
      {sub}
    </div>
  );
}

const NOTICE_TONE = {
  neutral: "bg-white shadow-[inset_0_0_0_1px_var(--line)]",
  warning: "bg-warning-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--warning)_35%,transparent)]",
  danger: "bg-danger-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_40%,transparent)]",
  signal: "bg-signal-soft shadow-[inset_3px_0_0_var(--blue)]",
  success: "bg-success-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--success)_35%,transparent)]",
};
export function Notice({ tone = "neutral", icon, children, className }: { tone?: keyof typeof NOTICE_TONE; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex gap-3 rounded-md p-4 text-sm text-text", NOTICE_TONE[tone], className)} role={tone === "danger" ? "alert" : "status"}>
      {icon && <Icon name={icon} size={18} className="mt-px" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ── Fields ─────────────────────────────────────────────────────────
export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint && <span className="-mt-1 text-xs text-faint">{hint}</span>}
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx("field", className)} {...p} />;
export const TextArea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx("field min-h-24 resize-y leading-normal [field-sizing:content]", className)} {...p} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx("field field-select", className)} {...p}>{children}</select>;

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-sm bg-surface px-1.5 font-mono text-[11px] text-muted shadow-[inset_0_0_0_1px_var(--line),inset_0_-1px_0_var(--line)]">{children}</kbd>;
}

export function Skeleton({ w = "100%", h = 14, className }: { w?: number | string; h?: number; className?: string }) {
  return <span aria-hidden className={cx("skeleton block", className)} style={{ width: w, height: h }} />;
}

export function Working({ label, steps }: { label: string; steps?: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (!steps?.length) return; const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 2600); return () => clearInterval(t); }, [steps]);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-ink"><Mark size={14} pulse />{steps?.[i] ?? label}</div>
      <div className="scan-line" />
    </div>
  );
}

export function Empty({ icon = "spark", title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="contours flex flex-col items-start gap-3 rounded-lg bg-white p-8 shadow-[inset_0_0_0_1px_var(--line)]">
      <span className="grid size-10 place-items-center rounded-md bg-signal text-on-signal"><Icon name={icon} size={18} /></span>
      <h3 className="text-h3 font-medium">{title}</h3>
      {children && <div className="measure text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: { message: string; engineDown?: boolean } | string; onRetry?: () => void }) {
  const msg = typeof error === "string" ? error : error.message;
  return (
    <Notice tone="danger" icon="flag">
      <p>{msg}</p>
      {onRetry && <button className="mt-2 text-sm text-signal-bright underline underline-offset-4" onClick={onRetry}>Try again</button>}
    </Notice>
  );
}

export function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: Size }) {
  const [done, setDone] = useState(false);
  return (
    <Button size={size} icon={done ? "check" : "copy"} onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); }}>
      {done ? "Copied" : label}
    </Button>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────
export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[85] flex justify-end" role="dialog" aria-modal aria-labelledby={id}>
      <button aria-label="Close" className="absolute inset-0 bg-[rgb(10_26_51/0.28)] animate-fade" onClick={onClose} />
      <div ref={ref} className={cx("relative flex h-dvh w-full flex-col overflow-hidden bg-white shadow-2 animate-rise", wide ? "max-w-[760px]" : "max-w-[520px]")}>
        <div className="flex items-center justify-between border-b-2 border-ink py-3 pl-4 pr-2 pt-[calc(12px+env(safe-area-inset-top))] sm:px-6 sm:py-4">
          <h2 id={id} className="t-heading text-h2">{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ── Toasts ─────────────────────────────────────────────────────────
type ToastT = { id: number; text: string; tone?: "danger" | "success"; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(t: Omit<ToastT, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastT[]>([]);
  const push = useCallback((t: Omit<ToastT, "id">) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((y) => y.id !== id)), t.action ? 7000 : 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 min-[900px]:inset-x-0 min-[900px]:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto flex items-center gap-3 bg-ink px-4 py-3 text-sm text-white shadow-2 animate-rise",
            t.tone === "danger" && "shadow-[inset_3px_0_0_var(--danger)]", t.tone === "success" && "shadow-[inset_3px_0_0_#4ade9a]")}>
            {t.tone === "success" ? <Icon name="check" size={16} /> : t.tone === "danger" ? <Icon name="flag" size={16} /> : <Mark size={12} />}
            <span className="text-white">{t.text}</span>
            {t.action && <button className="font-medium text-dawn hover:underline" onClick={t.action.run}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Long-form text written by the engine: a tiny, safe markdown subset (headings, lists, bold), no HTML injection. */
export function Prose({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  const inline = (s: string, k: string) => s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={`${k}${i}`}>{p.slice(2, -2)}</strong>
      : p.length > 2 && p.startsWith("*") && p.endsWith("*") ? <em key={`${k}${i}`}>{p.slice(1, -1)}</em> : p);
  return (
    <div className="prose-sage">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const h = b.match(/^(#{1,3})\s+(.*)$/);
        if (h && lines.length === 1) { const H = (`h${h[1].length}`) as "h1"; return <H key={i}>{inline(h[2], `h${i}`)}</H>; }
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          const L = ordered ? "ol" : "ul";
          return <L key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), `${i}.${j}`)}</li>)}</L>;
        }
        return <p key={i}>{lines.map((l, j) => (/^#{1,3}\s/.test(l) ? <strong key={j} className="block">{l.replace(/^#+\s/, "")}</strong> : <span key={j}>{inline(l, `${i}.${j}`)}{j < lines.length - 1 && <br />}</span>))}</p>;
      })}
    </div>
  );
}
