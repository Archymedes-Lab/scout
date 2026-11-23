"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Settles its children in once, when they scroll into view. Visible immediately under reduced motion (CSS). */
export function Reveal({ children, delay = 0, className, as: As = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"out" | "in">("out");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setState("in"); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <As ref={ref} data-reveal={state} className={className} style={{ ["--delay" as string]: `${delay}ms` }}>{children}</As>;
}
