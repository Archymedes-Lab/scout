// Scout's imagery: a topographic survey map. Where Sage draws hills, Scout reads the terrain: contour lines traced by
// marching squares over a smooth seeded field, every fourth line heavier (index contours), and a few vermilion pins for
// the places found. Pure function of (seed): identical on server and client, no image files. Colours come from tokens.

/** Kept from Sage's page headers; Scout draws one map per seed, so the variant only names the page's mood. */
export type LandVariant = "dawn" | "horizon" | "village" | "terraces" | "mist" | "night" | "contour";

const W = 1600;
const H = 560;
const STEP = 16;
const NX = W / STEP;
const NY = H / STEP;

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A smooth terrain: a handful of gaussian hills and hollows, wider than tall like a valley seen from above. */
function field(seed: number) {
  const rand = rng(seed);
  const bumps = Array.from({ length: 9 }, () => ({
    x: rand() * W, y: rand() * H * 1.1, h: (rand() > 0.25 ? 1 : -0.6) * (0.5 + rand()),
    sx: 160 + rand() * 260, sy: 90 + rand() * 160,
  }));
  return (x: number, y: number) => bumps.reduce((v, b) => v + b.h * Math.exp(-(((x - b.x) / b.sx) ** 2 + ((y - b.y) / b.sy) ** 2)), 0);
}

/** Marching squares: line segments where the field crosses `level`, as one SVG path. */
function contour(values: number[][], level: number): string {
  const lerp = (a: number, b: number) => (level - a) / (b - a || 1e-9);
  let d = "";
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = values[j]![i]!, b = values[j]![i + 1]!, c = values[j + 1]![i + 1]!, e = values[j + 1]![i]!;
    const k = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (e > level ? 1 : 0);
    if (k === 0 || k === 15) continue;
    const x = i * STEP, y = j * STEP;
    const top: [number, number] = [x + STEP * lerp(a, b), y];
    const right: [number, number] = [x + STEP, y + STEP * lerp(b, c)];
    const bottom: [number, number] = [x + STEP * lerp(e, c), y + STEP];
    const left: [number, number] = [x, y + STEP * lerp(a, e)];
    const seg = (p: [number, number], q: [number, number]) => { d += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`; };
    switch (k) {
      case 1: case 14: seg(left, bottom); break;
      case 2: case 13: seg(bottom, right); break;
      case 3: case 12: seg(left, right); break;
      case 4: case 11: seg(top, right); break;
      case 6: case 9: seg(top, bottom); break;
      case 7: case 8: seg(left, top); break;
      case 5: seg(left, top); seg(bottom, right); break;
      case 10: seg(top, right); seg(left, bottom); break;
    }
  }
  return d;
}

export function Topo({ seed = 7, className }: { seed?: number; variant?: LandVariant; className?: string }) {
  const f = field(seed);
  const values = Array.from({ length: NY + 1 }, (_, j) => Array.from({ length: NX + 1 }, (_, i) => f(i * STEP, j * STEP)));
  const flat = values.flat();
  const lo = Math.min(...flat), hi = Math.max(...flat);
  const levels = Array.from({ length: 22 }, (_, k) => lo + ((k + 1) / 23) * (hi - lo));
  const rand = rng(seed + 101);
  // Pins sit where the terrain is high: places worth going to.
  const pins = Array.from({ length: 40 }, () => ({ x: 120 + rand() * (W - 240), y: 70 + rand() * (H * 0.55) }))
    .map((p) => ({ ...p, v: f(p.x, p.y) })).sort((a, b) => b.v - a.v).slice(0, 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`topo-bg-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--dawn-light)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--bg)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#topo-bg-${seed})`} />
      <g fill="none" stroke="var(--dawn-deep)" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        {levels.map((l, k) => (
          <path key={k} d={contour(values, l)} strokeOpacity={k % 4 === 3 ? 0.42 : 0.18} strokeWidth={k % 4 === 3 ? 1.4 : 0.9} />
        ))}
      </g>
      {pins.map((p, k) => (
        <g key={k} transform={`translate(${r1(p.x)} ${r1(p.y)})`}>
          <circle r="16" fill="var(--blue)" opacity="0.1" className="animate-ring" />
          <rect x="-5" y="-5" width="10" height="10" fill="var(--blue)" />
          <rect x="-1.5" y="-1.5" width="3" height="3" fill="var(--on-signal)" />
        </g>
      ))}
    </svg>
  );
}
