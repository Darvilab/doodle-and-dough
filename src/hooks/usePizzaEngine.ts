import { useEffect, useRef, useState, useCallback } from 'react';
import { OrderState, ToppingId, SceneTopping } from '../types/pizza';
import { CATALOG, TOPSIZE, CHEESE_C, CRUST_COLOR_STOPS, SAUCE_NEED } from '../constants/catalog';
import { SND, vib, startRumble, stopRumble, getAudioContext } from '../services/audio';

const TAU = Math.PI * 2;
const INK = '#33241A';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t: number) => t * (2 - t);
const easeInQuad = (t: number) => t * t;
const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function mulberry32(s: number) {
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex2rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(h1: string, h2: string, t: number): string {
  const a = hex2rgb(h1);
  const b = hex2rgb(h2);
  return (
    '#' +
    [0, 1, 2]
      .map((i) =>
        Math.round(lerp(a[i], b[i], t))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

function rgbaHex(h: string, a: number): string {
  const [r, g, b] = hex2rgb(h);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/** Accepts '#rrggbb' or 'rgba(r,g,b,a)' and returns '#rrggbb' (alpha dropped). */
function cssToHex(c: string): string {
  if (c.startsWith('#')) return c;
  const m = c.match(/[\d.]+/g);
  if (!m || m.length < 3) return '#F3CB77';
  return (
    '#' +
    m
      .slice(0, 3)
      .map((v) => Math.round(Number(v)).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Melted-cheese palette: creamy body plus a darker golden edge where the molten mass ends. */
function cheeseLookOf(colors: string[]) {
  const hexes = colors.map(cssToHex);
  let avg = hexes[0];
  for (let i = 1; i < hexes.length; i++) avg = mixHex(avg, hexes[i], 1 / (i + 1));
  return {
    body: mixHex(avg, '#FFF4DA', 0.2),
    edge: mixHex(avg, '#B8661F', 0.5)
  };
}

function rrPath(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w <= 0 || h <= 0) return;
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Multi-harmonic organic contour variation for natural hand-stretched artisanal dough */
const doughBump = (a: number) =>
  Math.sin(a * 2 + 1.1) * 0.45 +
  Math.sin(a * 3 + 2.4) * 0.35 +
  Math.sin(a * 5 - 0.9) * 0.22 +
  Math.sin(a * 7 + 3.3) * 0.14 +
  Math.sin(a * 11 - 1.7) * 0.08;

const organicR = (a: number, baseR: number, wobble: number = 0.048) => {
  return baseR * (1 + wobble * doughBump(a));
};

const drawOrganicPath = (
  g: CanvasRenderingContext2D,
  px: number,
  py: number,
  r: number,
  wobble: number = 0.048,
  a0: number = 0,
  a1: number = TAU,
  steps: number = 64
) => {
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const rad = organicR(a, r, wobble);
    const x = px + Math.cos(a) * rad;
    const y = py + Math.sin(a) * rad;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
};

function crustColor(d: number): string {
  d = clamp(d, 0, 1.2);
  for (let i = 1; i < CRUST_COLOR_STOPS.length; i++) {
    if (d <= CRUST_COLOR_STOPS[i][0]) {
      const t =
        (d - CRUST_COLOR_STOPS[i - 1][0]) / (CRUST_COLOR_STOPS[i][0] - CRUST_COLOR_STOPS[i - 1][0]);
      return mixHex(CRUST_COLOR_STOPS[i - 1][1], CRUST_COLOR_STOPS[i][1], t);
    }
  }
  return CRUST_COLOR_STOPS[CRUST_COLOR_STOPS.length - 1][1];
}

interface Particle {
  x: number;
  y: number;
  r: number;
  a: number;
  vy: number;
  vx?: number;
  vr?: number;
  sw?: number;
  pType?: 'spark' | 'cinder' | 'flake';
  life?: number;
  maxLife?: number;
}

interface CheeseDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  lx: number;
  ly: number;
  r: number;
  rot: number;
  vr: number;
  c: string;
}

export interface EngineTopping {
  type: ToppingId;
  x: number;
  y: number;
  zone: 'whole' | 'left' | 'right';
  rot: number;
  s: number;
  born: number;
}

// 20x20 grid cells within radius 0.72
const GN = 20;
const STATIC_CELLS: { x: number; y: number; i: number; j: number }[] = [];
for (let i = 0; i < GN; i++) {
  for (let j = 0; j < GN; j++) {
    const x = -0.82 + (i + 0.5) * (1.64 / GN);
    const y = -0.82 + (j + 0.5) * (1.64 / GN);
    if (Math.hypot(x, y) < 0.72) {
      STATIC_CELLS.push({ x, y, i, j });
    }
  }
}

// Procedural decor spots
const r1 = mulberry32(1234);
const STATIC_BOARD_STREAKS: { px: number; py: number; len: number; ang: number; w: number }[] = [];
for (let i = 0; i < 10; i++) {
  STATIC_BOARD_STREAKS.push({
    px: r1(),
    py: r1(),
    len: 0.2 + r1() * 0.4,
    ang: (r1() - 0.5) * 0.3,
    w: 1 + r1() * 2
  });
}
const STATIC_FLOUR_PATCHES: { px: number; py: number; r: number }[] = [];
for (let i = 0; i < 6; i++) {
  STATIC_FLOUR_PATCHES.push({ px: r1(), py: r1(), r: 8 + r1() * 18 });
}

const r2 = mulberry32(777);
const STATIC_TEX_SPOTS: { x: number; y: number; r: number; al: number; dark: boolean }[] = [];
for (let i = 0; i < 42; i++) {
  const a = r2() * TAU;
  const rr = Math.sqrt(r2()) * 0.95;
  STATIC_TEX_SPOTS.push({
    x: Math.cos(a) * rr,
    y: Math.sin(a) * rr,
    r: 0.015 + r2() * 0.03,
    al: 0.04 + r2() * 0.05,
    dark: r2() > 0.5
  });
}

const STATIC_BLISTERS: { x: number; y: number; rr: number; r: number; thr: number }[] = [];
for (let i = 0; i < 26; i++) {
  const a = r2() * TAU;
  STATIC_BLISTERS.push({
    x: Math.cos(a),
    y: Math.sin(a),
    rr: 0.8 + r2() * 0.16,
    r: 0.02 + r2() * 0.025,
    thr: 0.3 + r2() * 0.6
  });
}

// Gaps in the melted cheese where the sauce peeks through
const r3 = mulberry32(4242);
const STATIC_CHEESE_HOLES: { x: number; y: number; r: number }[] = [];
for (let i = 0; i < 16; i++) {
  const a = r3() * TAU;
  const rr = Math.sqrt(r3()) * 0.86;
  STATIC_CHEESE_HOLES.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: 0.045 + r3() * 0.04 });
}

const STATIC_DOUGH_DIMPLES: { a: number; d: number; r: number }[] = [];
for (let i = 0; i < 8; i++) {
  STATIC_DOUGH_DIMPLES.push({ a: r2() * TAU, d: 0.2 + r2() * 0.55, r: 0.05 + r2() * 0.06 });
}

export interface UsePizzaEngineOptions {
  state: OrderState;
  sceneMirror?: SceneTopping[];
  onCommitTopping: (
    id: ToppingId,
    zone: 'whole' | 'left' | 'right',
    x: number,
    y: number
  ) => number;
  onCanPlace: (id: ToppingId) => { ok: boolean; reason?: string };
  onShowToast: (msg: string) => void;
  onAdvanceStage: (nextStage: OrderState['stage']) => void;
  onSetPulled: (pulled: boolean) => void;
  onSetBakeQ: (q: OrderState['bakeQ']) => void;
  onSpawnChip: (x: number, y: number, charge: number) => void;
}

export function usePizzaEngine(options: UsePizzaEngineOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep latest options in ref to avoid re-binding effect
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Sync mirror from sceneMirror prop
  useEffect(() => {
    if (options.sceneMirror) {
      engineRef.current.mirror = options.sceneMirror;
    }
  }, [options.sceneMirror]);

  // Throttled UI status states (updated at 10Hz)
  const [spread, setSpread] = useState(0);
  const [sauceCoverage, setSauceCoverage] = useState(0);
  const [cheeseCoverage, setCheeseCoverage] = useState(0);
  const [sauceDone, setSauceDone] = useState(false);
  const [cheeseDone, setCheeseDone] = useState(false);
  const [liveDoneness, setLiveDoneness] = useState(0);
  const [isBaking, setIsBaking] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);
  const [isTossing, setIsTossing] = useState(false);

  // Engine state refs
  const engineRef = useRef({
    spread: 0,
    sauceDone: false,
    cheeseDone: false,
    tossed: false,
    rollToasted: false,
    sauceColor: CATALOG.sauces[options.state.sauceId].color,
    time: 0,
    shake: 0,
    sauce: [] as { x: number; y: number; r: number }[],
    cheese: [] as { x: number; y: number; r: number; c: string }[],
    mirror: [] as EngineTopping[],
    bubbles: [] as { x: number; y: number; r: number; t: number }[],
    toastSpots: [] as { x: number; y: number; r: number }[],
    drops: [] as CheeseDrop[],
    puffs: [] as Particle[],
    steams: [] as Particle[],
    embers: [] as Particle[],
    toss: { on: false, t: 0, landed: false },
    peel: { vis: false, x: 0, phase: '', t: 0 },
    pizzaOffX: 0,
    inOven: false,
    baking: false,
    reviewReady: false,
    doneness: 0,
    pin: { x: 0, vx: 0 },
    ladle: { x: 0, y: 0 },
    ptr: { down: false, x: 0, y: 0 },
    carried: null as { type: ToppingId } | null,
    carriedPos: { x: 0, y: 0 },
    rollAcc: 0,
    lastS: null as { x: number; y: number } | null,
    spawnAcc: 0,
    landAcc: 0,
    W: 0,
    H: 0,
    DPR: 1,
    cx: 0,
    cy: 0,
    baseR: 120,
    R: 0,
    boardR: -1,
    boardW: -1,
    boardH: -1,
    baseKey: '',
    sauceDirty: true,
    cheeseDirty: true,
    meterAcc: 0,
    cheeseMeltKey: -1,
    cheeseLook: cheeseLookOf(CHEESE_C)
  });

  // Offscreen canvas caches
  const offscreenRef = useRef<{
    sauceC: HTMLCanvasElement;
    sauceX: CanvasRenderingContext2D;
    cheeseC: HTMLCanvasElement;
    cheeseX: CanvasRenderingContext2D;
    ovenC: HTMLCanvasElement;
    ovenX: CanvasRenderingContext2D;
    boardC: HTMLCanvasElement;
    boardX: CanvasRenderingContext2D;
    baseC: HTMLCanvasElement;
    baseX: CanvasRenderingContext2D;
    reviewC: HTMLCanvasElement;
    reviewX: CanvasRenderingContext2D;
  } | null>(null);

  if (!offscreenRef.current) {
    const sauceC = document.createElement('canvas');
    const cheeseC = document.createElement('canvas');
    const ovenC = document.createElement('canvas');
    const boardC = document.createElement('canvas');
    const baseC = document.createElement('canvas');
    const reviewC = document.createElement('canvas');
    offscreenRef.current = {
      sauceC,
      sauceX: sauceC.getContext('2d')!,
      cheeseC,
      cheeseX: cheeseC.getContext('2d')!,
      ovenC,
      ovenX: ovenC.getContext('2d')!,
      boardC,
      boardX: boardC.getContext('2d')!,
      baseC,
      baseX: baseC.getContext('2d')!,
      reviewC,
      reviewX: reviewC.getContext('2d')!
    };
  }

  const sauceCellsRef = useRef(new Set<string>());
  const cheeseCellsRef = useRef(new Set<string>());

  const innerFrac = () => {
    return 1 - CATALOG.crusts[optionsRef.current.state.crustId].rim;
  };

  const markCells = (set: Set<string>, x: number, y: number, r: number) => {
    const rr = (r + 0.055) * (r + 0.055);
    for (const c of STATIC_CELLS) {
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx * dx + dy * dy < rr) {
        set.add(c.i + '_' + c.j);
      }
    }
  };

  const coverageOf = (set: Set<string>) => {
    return STATIC_CELLS.length > 0 ? set.size / STATIC_CELLS.length : 0;
  };

  const blobDraw = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.arc(x + r * 0.55, y + r * 0.2, r * 0.55, 0, TAU);
    g.arc(x - r * 0.4, y - r * 0.35, r * 0.5, 0, TAU);
    g.fill();
  };

  const blitSauce = (o: { x: number; y: number; r: number }) => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    const inn = innerFrac();
    const sx = offscreenRef.current.sauceX;
    sx.globalAlpha = 0.45;
    sx.fillStyle = eng.sauceColor;
    blobDraw(sx, eng.cx + o.x * eng.R * inn, eng.cy + o.y * eng.R * inn, o.r * eng.R * inn);
    sx.globalAlpha = 1;
  };

  const blitCheese = (o: { x: number; y: number; r: number; c: string }) => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    const inn = innerFrac();
    const cx = offscreenRef.current.cheeseX;
    cx.fillStyle = o.c;
    blobDraw(cx, eng.cx + o.x * eng.R * inn, eng.cy + o.y * eng.R * inn, o.r * eng.R * inn);
  };

  const repaintSauce = () => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    const sx = offscreenRef.current.sauceX;
    sx.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
    sx.clearRect(0, 0, eng.W, eng.H);
    for (const o of eng.sauce) {
      blitSauce(o);
    }
    eng.sauceDirty = false;
  };

  /** Same three-lobe outline as blobDraw, as a path only (for strokes). */
  const blobOutline = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    g.moveTo(x + r, y);
    g.arc(x, y, r, 0, TAU);
    g.moveTo(x + r * 0.55 + r * 0.55, y + r * 0.2);
    g.arc(x + r * 0.55, y + r * 0.2, r * 0.55, 0, TAU);
    g.moveTo(x - r * 0.4 + r * 0.5, y - r * 0.35);
    g.arc(x - r * 0.4, y - r * 0.35, r * 0.5, 0, TAU);
  };

  /**
   * Cheese goes from loose shreds (raw) to one molten, glossy mass as the pizza bakes:
   * blobs swell and merge, a darker golden rim outlines the pools, sauce peeks through
   * a few gaps, and the surface browns towards the crust.
   */
  const repaintCheese = () => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    const cx = offscreenRef.current.cheeseX;
    cx.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
    cx.clearRect(0, 0, eng.W, eng.H);
    const state = optionsRef.current.state;
    const colors = CATALOG.cheeses[state.cheeseId]?.colors || CHEESE_C;
    const look = cheeseLookOf(colors);
    eng.cheeseLook = look;
    eng.cheeseDirty = false;
    if (!eng.cheese.length) return;

    const k = eng.R * innerFrac();
    const d = eng.doneness;
    const melt = clamp((d - 0.2) / 0.45, 0, 1);
    const extra = Math.max(0, (state.cheeseUnits || 1) - 1) + (state.extraCheese ? 1 : 0);
    const grow = 1 + melt * (0.3 + Math.min(0.2, extra * 0.05));

    for (let i = 0; i < eng.cheese.length; i++) {
      eng.cheese[i].c = colors[i % colors.length];
    }

    // 1. Darker golden rim — only survives where the molten mass ends
    if (melt > 0) {
      cx.globalAlpha = melt;
      cx.fillStyle = look.edge;
      for (const o of eng.cheese) {
        blobDraw(cx, eng.cx + o.x * k, eng.cy + o.y * k, o.r * k * grow + 1.8);
      }
      cx.globalAlpha = 1;
    }

    // 2. Cheese body: individual shreds blend into one creamy colour as they melt
    for (const o of eng.cheese) {
      cx.fillStyle = melt > 0 ? mixHex(cssToHex(o.c), look.body, melt) : o.c;
      blobDraw(cx, eng.cx + o.x * k, eng.cy + o.y * k, o.r * k * grow);
    }

    // 3. Sauce peeking through gaps in the molten cheese, each gap rimmed in golden brown
    const holeA = clamp((melt - 0.25) / 0.5, 0, 1);
    cx.globalCompositeOperation = 'source-atop';
    if (holeA > 0) {
      cx.globalAlpha = holeA;
      cx.fillStyle = mixHex(eng.sauceColor, '#7A1E10', 0.15);
      for (const h of STATIC_CHEESE_HOLES) {
        blobDraw(cx, eng.cx + h.x * k, eng.cy + h.y * k, h.r * k);
      }
      cx.strokeStyle = look.edge;
      cx.lineWidth = 2.4;
      cx.beginPath();
      for (const h of STATIC_CHEESE_HOLES) {
        blobOutline(cx, eng.cx + h.x * k, eng.cy + h.y * k, h.r * k);
      }
      cx.stroke();
      cx.globalAlpha = 1;
    }

    // 4. Oven browning: stronger towards the hot outer edge
    const brown = clamp((d - 0.45) / 0.45, 0, 1.4);
    if (brown > 0) {
      const grad = cx.createRadialGradient(eng.cx, eng.cy, 0, eng.cx, eng.cy, k);
      grad.addColorStop(0, `rgba(232,160,60,${(0.1 * brown).toFixed(3)})`);
      grad.addColorStop(0.6, `rgba(214,132,42,${(0.26 * brown).toFixed(3)})`);
      grad.addColorStop(1, `rgba(160,82,26,${(0.5 * brown).toFixed(3)})`);
      cx.fillStyle = grad;
      cx.fillRect(eng.cx - k, eng.cy - k, k * 2, k * 2);
    }

    // 5. Glossy highlights on the molten surface
    if (melt > 0) {
      cx.strokeStyle = `rgba(255,253,240,${(0.6 * melt).toFixed(3)})`;
      cx.lineCap = 'round';
      cx.lineWidth = 1.6;
      cx.beginPath();
      for (let i = 0; i < eng.cheese.length; i += 9) {
        const o = eng.cheese[i];
        const r = o.r * k * grow;
        const x = eng.cx + o.x * k - r * 0.25;
        const y = eng.cy + o.y * k - r * 0.3;
        cx.moveTo(x + Math.cos(3.6) * r * 0.5, y + Math.sin(3.6) * r * 0.5);
        cx.arc(x, y, r * 0.5, 3.6, 4.9);
      }
      cx.stroke();
      cx.fillStyle = `rgba(255,255,248,${(0.75 * melt).toFixed(3)})`;
      cx.beginPath();
      for (let i = 4; i < eng.cheese.length; i += 23) {
        const o = eng.cheese[i];
        const x = eng.cx + o.x * k;
        const y = eng.cy + o.y * k;
        cx.moveTo(x + 1.3, y);
        cx.arc(x, y, 1.3, 0, TAU);
      }
      cx.fill();
    }

    cx.globalCompositeOperation = 'source-over';
  };

  const blobPath = (
    g: CanvasRenderingContext2D,
    px: number,
    py: number,
    rs: number,
    a0: number = 0,
    a1: number = TAU
  ) => {
    const eng = engineRef.current;
    drawOrganicPath(g, px, py, eng.R * rs, 0.048, a0, a1);
    g.closePath();
  };

  const buildBase = () => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    const g = offscreenRef.current.baseX;
    g.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
    g.clearRect(0, 0, eng.W, eng.H);

    const d = eng.doneness;
    const inn = innerFrac();
    const crustType = optionsRef.current.state.crustId;
    let crust = crustColor(d);

    // Crust-specific base tones
    if (crustType === 'pan') {
      crust = mixHex(crust, '#B46C20', 0.28 + d * 0.15); // Rich deep-dish golden brown
    } else if (crustType === 'stuffed') {
      crust = mixHex(crust, '#CFA058', 0.22); // Plump, golden-baked dough
    }

    // Outer baked crust base
    blobPath(g, eng.cx, eng.cy, 1, 0, TAU);
    g.fillStyle = crust;
    g.fill();

    // Natural dough texture specks
    g.save();
    blobPath(g, eng.cx, eng.cy, 1, 0, TAU);
    g.clip();
    for (const s of STATIC_TEX_SPOTS) {
      g.fillStyle = s.dark
        ? `rgba(120,80,40,${(s.al + d * 0.05).toFixed(3)})`
        : `rgba(255,244,214,${s.al})`;
      g.beginPath();
      g.arc(eng.cx + s.x * eng.R, eng.cy + s.y * eng.R, s.r * eng.R, 0, TAU);
      g.fill();
    }
    g.restore();

    // Crust-specific rim shading and distinctive organic anatomy
    const rimThickness = eng.R * (1 - inn);
    const midRimR = eng.R * (inn + 1) * 0.5;

    if (crustType === 'stuffed') {
      // 1. Cheese Stuffed: Plump, continuous folded artisan cornicione filled with molten mozzarella
      // Deep outer baked shadow ring under the plump cornicione
      g.save();
      blobPath(g, eng.cx, eng.cy, 1, 0, TAU);
      g.clip();
      const grad = g.createRadialGradient(eng.cx, eng.cy, eng.R * inn * 0.9, eng.cx, eng.cy, eng.R);
      grad.addColorStop(0, 'rgba(60, 30, 10, 0.42)');
      grad.addColorStop(0.35, 'rgba(225, 160, 75, 0.26)');
      grad.addColorStop(0.7, 'rgba(250, 205, 125, 0.22)');
      grad.addColorStop(1, 'rgba(90, 42, 12, 0.58)');
      g.fillStyle = grad;
      g.fillRect(eng.cx - eng.R * 1.1, eng.cy - eng.R * 1.1, eng.R * 2.2, eng.R * 2.2);

      // Continuous plump torus cornicione body (soft dough roll)
      drawOrganicPath(g, eng.cx, eng.cy, midRimR, 0.046);
      g.strokeStyle = mixHex(crust, '#F2C47A', 0.22);
      g.lineWidth = rimThickness * 0.76;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.stroke();

      // Top ridge highlight of the plump dough roll with gentle flour sheen
      drawOrganicPath(g, eng.cx, eng.cy, midRimR * 1.01, 0.044);
      g.strokeStyle = 'rgba(255, 224, 150, 0.4)';
      g.lineWidth = rimThickness * 0.36;
      g.stroke();

      // Organic hand-crimped fold pleats along the perimeter (subtle dough folds, not disconnected beads)
      const pleats = 14;
      for (let i = 0; i < pleats; i++) {
        const a = (i / pleats) * TAU + Math.sin(i * 1.7) * 0.08;
        const pR0 = organicR(a, eng.R * (inn + 0.02), 0.038);
        const pR1 = organicR(a, eng.R * 0.98, 0.046);
        const midA = a + 0.04;
        g.strokeStyle = 'rgba(78, 38, 14, 0.32)';
        g.lineWidth = 1.8;
        g.beginPath();
        g.moveTo(eng.cx + Math.cos(a) * pR0, eng.cy + Math.sin(a) * pR0);
        g.quadraticCurveTo(
          eng.cx + Math.cos(midA) * (pR0 + pR1) * 0.5,
          eng.cy + Math.sin(midA) * (pR0 + pR1) * 0.5,
          eng.cx + Math.cos(a) * pR1,
          eng.cy + Math.sin(a) * pR1
        );
        g.stroke();
      }
      g.restore();
    } else if (crustType === 'pan') {
      // 2. Pan Crust: Thick, rustic deep-dish golden fried crust with crisp iron-skillet edge
      g.save();
      blobPath(g, eng.cx, eng.cy, 1, 0, TAU);
      g.clip();
      const panGrad = g.createRadialGradient(
        eng.cx,
        eng.cy,
        eng.R * inn * 0.95,
        eng.cx,
        eng.cy,
        eng.R
      );
      panGrad.addColorStop(0, 'rgba(120, 60, 20, 0.35)');
      panGrad.addColorStop(0.45, 'rgba(215, 140, 50, 0.38)');
      panGrad.addColorStop(0.85, 'rgba(180, 95, 30, 0.55)');
      panGrad.addColorStop(1, 'rgba(65, 30, 10, 0.7)');
      g.fillStyle = panGrad;
      g.fillRect(eng.cx - eng.R * 1.1, eng.cy - eng.R * 1.1, eng.R * 2.2, eng.R * 2.2);

      // Organic skillet darkened edge
      drawOrganicPath(g, eng.cx, eng.cy, eng.R - rimThickness * 0.12, 0.045);
      g.strokeStyle = 'rgba(85, 38, 12, 0.6)';
      g.lineWidth = rimThickness * 0.22;
      g.stroke();

      // Rustic bubbly golden highlights
      drawOrganicPath(g, eng.cx, eng.cy, midRimR, 0.04);
      g.strokeStyle = 'rgba(255, 220, 130, 0.35)';
      g.lineWidth = 3;
      g.stroke();
      g.restore();
    } else {
      // 3. Thin Crust: Crisp, hand-stretched Roman/Neapolitan style with blistered cornicione
      g.save();
      blobPath(g, eng.cx, eng.cy, 1, 0, TAU);
      g.clip();
      const thinGrad = g.createRadialGradient(eng.cx, eng.cy, eng.R * inn, eng.cx, eng.cy, eng.R);
      thinGrad.addColorStop(0, 'rgba(90, 45, 15, 0.3)');
      thinGrad.addColorStop(0.4, 'rgba(250, 200, 120, 0.16)');
      thinGrad.addColorStop(0.75, 'rgba(190, 110, 40, 0.24)');
      thinGrad.addColorStop(1, 'rgba(95, 45, 15, 0.58)');
      g.fillStyle = thinGrad;
      g.fillRect(eng.cx - eng.R * 1.1, eng.cy - eng.R * 1.1, eng.R * 2.2, eng.R * 2.2);

      drawOrganicPath(g, eng.cx, eng.cy, eng.R - 2, 0.048);
      g.strokeStyle = 'rgba(110, 60, 25, 0.35)';
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
    }

    // Inner pizza floor (where sauce & cheese sit) — organic boundary!
    drawOrganicPath(g, eng.cx, eng.cy, eng.R * inn, 0.042);
    g.fillStyle = mixHex(crust, '#F0DFAF', 0.35);
    g.fill();

    // Distinct organic inner boundary crease separating rim and sauce floor
    drawOrganicPath(g, eng.cx, eng.cy, eng.R * (inn + 0.012), 0.042);
    g.strokeStyle =
      crustType === 'stuffed'
        ? 'rgba(50,22,8,0.45)'
        : crustType === 'pan'
          ? 'rgba(65,30,12,0.38)'
          : 'rgba(70,40,15,0.2)';
    g.lineWidth = crustType === 'stuffed' ? eng.R * 0.038 : eng.R * 0.026;
    g.stroke();

    // Crust sheen (organic arc)
    const sh = CATALOG.crusts[optionsRef.current.state.crustId].shine;
    drawOrganicPath(
      g,
      eng.cx,
      eng.cy,
      (eng.R * (inn + 1)) / 2,
      0.045,
      Math.PI * 1.05,
      Math.PI * 1.6,
      32
    );
    g.strokeStyle = `rgba(255,214,140,${(sh * 0.6).toFixed(3)})`;
    g.lineWidth = eng.R * (1 - inn) * 0.55;
    g.stroke();

    // Leopard-spot char blisters: soft-edged ovals stretched along the rim
    for (const b of STATIC_BLISTERS) {
      if (d > b.thr) {
        const k = clamp((d - b.thr) / 0.3, 0, 1);
        const a = Math.atan2(b.y, b.x);
        const blisterR = organicR(a, eng.R * b.rr, 0.04);
        const rr = b.r * eng.R * (0.9 + k * 0.6);
        const core = mixHex('#B06A28', '#2E170B', k);
        g.save();
        g.translate(eng.cx + b.x * blisterR, eng.cy + b.y * blisterR);
        g.rotate(a + Math.PI / 2);
        g.scale(1.45, 0.8);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, rr);
        grad.addColorStop(0, rgbaHex(core, 0.85));
        grad.addColorStop(0.5, rgbaHex(core, 0.5));
        grad.addColorStop(1, rgbaHex(core, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.arc(0, 0, rr, 0, TAU);
        g.fill();
        g.restore();
      }
    }

    // Hand-drawn rustic ink outline
    blobPath(g, eng.cx, eng.cy, 1, 0, TAU);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.stroke();
  };

  const buildBoard = () => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    if (!eng.W || !eng.H) return;
    const g = offscreenRef.current.boardX;
    g.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
    g.clearRect(0, 0, eng.W, eng.H);

    // Stable cutting board that fits comfortably inside the stage with generous workspace
    const maxBw = eng.W * 0.94;
    const maxBh = eng.H * 0.82;
    const bw = Math.min(maxBw, maxBh * 1.34, 460);
    const bh = bw * 0.74;
    const x = eng.cx - bw / 2;
    const y = eng.cy - bh / 2;

    g.fillStyle = 'rgba(58,38,20,.15)';
    rrPath(g, x + 5, y + 9, bw, bh, 26);
    g.fill();

    rrPath(g, x, y, bw, bh, 26);
    g.fillStyle = '#B7854F';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.stroke();

    g.save();
    rrPath(g, x, y, bw, bh, 26);
    g.clip();

    g.strokeStyle = 'rgba(107,70,32,.22)';
    for (const s of STATIC_BOARD_STREAKS) {
      g.lineWidth = s.w;
      const sx = x + s.px * bw;
      const sy = y + s.py * bh;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + Math.cos(s.ang) * s.len * bw * 0.4, sy + Math.sin(s.ang) * s.len * bw * 0.4);
      g.stroke();
    }

    // Light flour dusting: soft patches of specks rather than solid discs
    for (const f of STATIC_FLOUR_PATCHES) {
      const fx = x + f.px * bw;
      const fy = y + f.py * bh;
      const grad = g.createRadialGradient(fx, fy, 0, fx, fy, f.r);
      grad.addColorStop(0, 'rgba(255,251,238,.22)');
      grad.addColorStop(1, 'rgba(255,251,238,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(fx, fy, f.r, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,251,238,.5)';
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + f.r;
        const rr = f.r * (0.2 + ((i * 37) % 10) / 12);
        g.beginPath();
        g.arc(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr, 0.7 + (i % 3) * 0.35, 0, TAU);
        g.fill();
      }
    }

    g.restore();
  };

  const buildOven = () => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    const g = offscreenRef.current.ovenX;
    g.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
    g.fillStyle = '#22110A';
    g.fillRect(0, 0, eng.W, eng.H);

    // Warm Tuscan terracotta and firebrick color palette
    const cols = [
      '#6E2F1A',
      '#7F3820',
      '#592312',
      '#8C3F23',
      '#642715',
      '#974526',
      '#753218',
      '#5D2513'
    ];
    let k = 0;
    for (let row = 0, y = -10; y < eng.H; row++, y += 30) {
      for (let x = row % 2 ? -29 : -10; x < eng.W; x += 58) {
        g.fillStyle = cols[k++ % cols.length];
        rrPath(g, x + 2, y + 2, 54, 26, 4);
        g.fill();

        // Brick top & left warm bevel highlight
        g.strokeStyle = 'rgba(255, 190, 130, 0.16)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 5, y + 26);
        g.lineTo(x + 5, y + 5);
        g.lineTo(x + 53, y + 5);
        g.stroke();

        // Brick bottom & right shadow bevel
        g.strokeStyle = 'rgba(12, 5, 2, 0.42)';
        g.beginPath();
        g.moveTo(x + 53, y + 5);
        g.lineTo(x + 53, y + 26);
        g.lineTo(x + 5, y + 26);
        g.stroke();
      }
    }

    // Rustic firebrick stone hearth floor at the bottom
    const floorY = eng.H - 45;
    const hg = g.createLinearGradient(0, floorY - 10, 0, eng.H);
    hg.addColorStop(0, '#422014');
    hg.addColorStop(0.35, '#30160D');
    hg.addColorStop(1, '#1A0B05');
    g.fillStyle = hg;
    g.fillRect(0, floorY, eng.W, eng.H - floorY);

    // Hearth stone slab top lip with warm highlight
    g.strokeStyle = 'rgba(255, 180, 100, 0.28)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, floorY);
    g.lineTo(eng.W, floorY);
    g.stroke();

    // Hearth stone vertical tile seams
    g.strokeStyle = 'rgba(15, 6, 3, 0.65)';
    g.lineWidth = 2;
    for (let sx = 45; sx < eng.W; sx += 68) {
      g.beginPath();
      g.moveTo(sx, floorY);
      g.lineTo(sx, eng.H);
      g.stroke();
    }

    // Warm chamber dome / hearth vignette
    const vg = g.createRadialGradient(
      eng.cx,
      eng.cy - 15,
      eng.R * 0.4,
      eng.cx,
      eng.cy,
      Math.max(eng.W, eng.H) * 0.82
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.55, 'rgba(28, 10, 5, 0.22)');
    vg.addColorStop(1, 'rgba(14, 4, 2, 0.78)');
    g.fillStyle = vg;
    g.fillRect(0, 0, eng.W, eng.H);
  };

  const updateRadius = () => {
    const eng = engineRef.current;
    if (!eng.W || !eng.H) return;
    // Calculate cutting board dimensions to ensure the 15" pizza stays beautifully inside the board
    const maxBw = eng.W * 0.94;
    const maxBh = eng.H * 0.82;
    const bw = Math.min(maxBw, maxBh * 1.34, 460);
    const bh = bw * 0.74;

    // The largest pizza (15" with f: 1.22) will have radius at ~86% of half the board height
    const standardR = (bh * 0.5 * 0.86) / 1.22;
    const sizeFactor = CATALOG.sizes[optionsRef.current.state.sizeId]?.f || 1.0;
    eng.baseR = standardR * sizeFactor;
    if (!eng.R) eng.R = eng.baseR;
    eng.sauceDirty = true;
    eng.cheeseDirty = true;
    eng.baseKey = '';
    buildOven();
  };

  // Sync with changes to size, crust, sauce, cheese from React state WITHOUT reallocating canvases
  useEffect(() => {
    const eng = engineRef.current;
    eng.sauceColor = CATALOG.sauces[options.state.sauceId].color;
    eng.sauceDirty = true;
    eng.cheeseDirty = true;
    eng.baseKey = '';
    updateRadius();
    repaintCheese();
  }, [options.state.sizeId, options.state.crustId, options.state.sauceId, options.state.cheeseId]);

  // Sync with cheeseUnits/extraCheese to dynamically re-evaluate completion threshold and allow more cheese
  useEffect(() => {
    const eng = engineRef.current;
    const cov = coverageOf(cheeseCellsRef.current);
    const need = 0.58;
    const isDone = cov >= need || (need > 0 && cov / need >= 0.98);
    eng.cheeseDone = isDone;
    setCheeseDone(isDone);
  }, [options.state.cheeseUnits, options.state.extraCheese]);

  const flourPuff = (x: number, y: number) => {
    engineRef.current.puffs.push({
      x,
      y,
      r: 3 + Math.random() * 4,
      vr: 26 + Math.random() * 20,
      vy: -14 - Math.random() * 22,
      a: 0.5
    });
  };

  const flourBurst = (x: number, y: number, n: number) => {
    const eng = engineRef.current;
    for (let i = 0; i < n; i++) {
      flourPuff(x + (Math.random() - 0.5) * eng.R, y + (Math.random() - 0.5) * eng.R * 0.4);
    }
  };

  const steamBurst = (n: number) => {
    const eng = engineRef.current;
    for (let i = 0; i < n; i++) {
      eng.steams.push({
        x: eng.cx + (Math.random() - 0.5) * eng.R,
        y: eng.cy - eng.R * 0.4 * Math.random(),
        vy: -40 - Math.random() * 40,
        r: 4 + Math.random() * 7,
        a: 0.7
      });
    }
  };

  const trySauce = (x: number, y: number, force: boolean) => {
    const eng = engineRef.current;
    const inn = innerFrac();
    const lx = (x - eng.cx) / (eng.R * inn);
    const ly = (y - eng.cy) / (eng.R * inn);

    if (Math.hypot(lx, ly) > 0.92) return;
    if (!force && eng.lastS && Math.hypot(x - eng.lastS.x, y - eng.lastS.y) < 10) return;
    eng.lastS = { x, y };

    if (eng.sauce.length < 800) {
      const o = { x: lx, y: ly, r: 0.13 + Math.random() * 0.05 };
      eng.sauce.push(o);
      markCells(sauceCellsRef.current, lx, ly, o.r);
      blitSauce(o);

      if (Math.random() < 0.25) {
        const a = Math.random() * TAU;
        const dd = 0.16 + Math.random() * 0.14;
        const o2 = {
          x: lx + Math.cos(a) * dd,
          y: ly + Math.sin(a) * dd,
          r: 0.03 + Math.random() * 0.03
        };
        eng.sauce.push(o2);
        markCells(sauceCellsRef.current, o2.x, o2.y, o2.r);
        blitSauce(o2);
      }
      SND.squelch(eng.time);
    }

    const cov = coverageOf(sauceCellsRef.current);
    if (cov >= SAUCE_NEED && !eng.sauceDone) {
      eng.sauceDone = true;
      setSauceDone(true);
      optionsRef.current.onShowToast('Sauce: perfected');
      vib(15);
    }
  };

  const spawnCheese = () => {
    const eng = engineRef.current;
    const inn = innerFrac();

    // 1. Determine target on the pizza base where cheese will land
    // Convert current pointer position to normalized local coords [-1, 1] relative to sauce/cheese floor
    const ptrLx = (eng.ptr.x - eng.cx) / (eng.R * inn);
    const ptrLy = (eng.ptr.y - eng.cy) / (eng.R * inn);
    const ptrDist = Math.hypot(ptrLx, ptrLy);

    let targetLx: number;
    let targetLy: number;

    if (ptrDist <= 1.15) {
      // User is tapping/dragging on the pizza: sprinkle in a natural radius around their finger/cursor
      const sprinkleSpread = 0.28 + Math.random() * 0.18; // ~30-45% local dispersion radius
      const angle = Math.random() * TAU;
      const radius = Math.sqrt(Math.random()) * sprinkleSpread;
      targetLx = ptrLx + Math.cos(angle) * radius;
      targetLy = ptrLy + Math.sin(angle) * radius;
    } else {
      // User is clicking outside or general tapping: distribute across the pizza evenly
      const angle = Math.random() * TAU;
      const radius = Math.sqrt(Math.random()) * 0.88;
      targetLx = Math.cos(angle) * radius;
      targetLy = Math.sin(angle) * radius;
    }

    // Keep cheese inside pizza floor perimeter
    const d = Math.hypot(targetLx, targetLy);
    if (d > 0.92) {
      targetLx = (targetLx / d) * 0.92;
      targetLy = (targetLy / d) * 0.92;
    }

    // Target landing point in canvas coordinates
    const targetPx = eng.cx + targetLx * eng.R * inn;
    const targetPy = eng.cy + targetLy * eng.R * inn;

    // 2. Spawn drop from slightly above the finger/hand or target point
    const spawnPx = targetPx + (Math.random() - 0.5) * 24;
    const spawnPy = Math.min(eng.ptr.y - 20, targetPy - eng.R * 0.45) - Math.random() * 15;

    const cheeseType = optionsRef.current.state.cheeseId;
    const colors = CATALOG.cheeses[cheeseType]?.colors || CHEESE_C;
    const chosenColor = colors[(Math.random() * colors.length) | 0];

    eng.drops.push({
      x: spawnPx,
      y: spawnPy,
      vx: (targetPx - spawnPx) * 2.2,
      vy: 120 + Math.random() * 80,
      tx: targetPx,
      ty: targetPy,
      lx: targetLx,
      ly: targetLy,
      r: 0.032 + Math.random() * 0.022,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 8,
      c: chosenColor
    });
  };

  // Drawing helpers
  const drawTopping = (
    g: CanvasRenderingContext2D,
    t: { type: ToppingId; rot: number; s: number; born: number },
    x: number,
    y: number,
    d: number
  ) => {
    const eng = engineRef.current;
    // Stable per-piece size jitter (±10%) so toppings don't look stamped
    const jitter = Math.sin(t.rot * 43.7) * 0.5 + 0.5;
    const s = t.s * eng.R * (0.9 + jitter * 0.2);
    const melt = eng.cheese.length ? clamp((d - 0.3) / 0.4, 0, 1) : 0;
    g.save();
    g.translate(x, y);
    g.rotate(t.rot);
    if (t.born >= 0) {
      const age = eng.time - t.born;
      const sc = age >= 0 && age < 0.25 ? easeOutBack(clamp(age / 0.25, 0, 1)) : 1;
      g.scale(sc, sc);
    }
    const cook = clamp((d - 0.35) / 0.4, 0, 1);
    // Orange grease halo rendered out of pepperoni into the surrounding cheese
    if (t.type === 'pep' && cook > 0) {
      g.fillStyle = `rgba(222,112,30,${(0.3 * cook).toFixed(3)})`;
      g.beginPath();
      g.ellipse(0, 0, s * 1.28, s * 1.22, 0, 0, TAU);
      g.fill();
    }

    // Soft drop shadow that follows each topping's own silhouette (cleared after its first fill)
    g.shadowColor = 'rgba(40,20,8,.32)';
    g.shadowBlur = 3;
    g.shadowOffsetX = 1.5;
    g.shadowOffsetY = 2.5;
    const endShadow = () => {
      g.shadowColor = 'transparent';
    };

    if (t.type === 'pep') {
      g.beginPath();
      g.arc(0, 0, s, 0, TAU);
      g.fillStyle = mixHex('#C4402F', '#A8301F', cook);
      g.fill();
      endShadow();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      g.fillStyle = 'rgba(120,25,15,.5)';
      g.beginPath();
      g.arc(-s * 0.25, -s * 0.15, s * 0.2, 0, TAU);
      g.arc(s * 0.3, s * 0.25, s * 0.16, 0, TAU);
      g.fill();

      g.strokeStyle = 'rgba(226,110,80,.9)';
      g.lineWidth = s * 0.22;
      g.beginPath();
      g.arc(0, 0, s * 0.78, 0, TAU);
      g.stroke();

      if (cook > 0) {
        // Cupped, crisped edge
        g.strokeStyle = `rgba(90,20,10,${(0.65 * cook).toFixed(3)})`;
        g.lineWidth = s * 0.14;
        g.beginPath();
        g.arc(0, 0, s * 0.92, 0, TAU);
        g.stroke();
        // Little pool of oil in the cup, with a glint
        g.fillStyle = `rgba(236,122,38,${(0.55 * cook).toFixed(3)})`;
        g.beginPath();
        g.ellipse(s * 0.08, s * 0.1, s * 0.42, s * 0.34, 0.4, 0, TAU);
        g.fill();
        g.fillStyle = `rgba(255,248,225,${(0.85 * cook).toFixed(3)})`;
        g.beginPath();
        g.ellipse(-s * 0.32, -s * 0.36, s * 0.16, s * 0.09, -0.6, 0, TAU);
        g.fill();
      }
    } else if (t.type === 'prosc') {
      g.beginPath();
      g.moveTo(-s, 0.1 * s);
      g.bezierCurveTo(-s * 1.1, -s * 0.9, 0, -s * 1.05, s * 0.9, -s * 0.5);
      g.bezierCurveTo(s * 1.15, 0.1 * s, s * 0.6, s * 0.95, -0.1 * s, s * 0.85);
      g.bezierCurveTo(-s * 0.7, s * 0.8, -s * 0.95, s * 0.6, -s, 0.1 * s);
      g.closePath();
      g.fillStyle = '#E6907E';
      g.fill();
      endShadow();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      g.strokeStyle = 'rgba(250,215,200,.85)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-s * 0.5, -s * 0.1);
      g.quadraticCurveTo(0, -s * 0.35, s * 0.55, -s * 0.15);
      g.moveTo(-s * 0.4, s * 0.3);
      g.quadraticCurveTo(s * 0.1, s * 0.1, s * 0.5, s * 0.3);
      g.stroke();
    } else if (t.type === 'mush') {
      g.beginPath();
      g.moveTo(-s, 0.1 * s);
      g.quadraticCurveTo(-s * 0.9, -s * 0.75, 0, -s * 0.8);
      g.quadraticCurveTo(s * 0.9, -s * 0.75, s, 0.1 * s);
      g.lineTo(s * 0.35, 0.1 * s);
      g.lineTo(s * 0.28, s * 0.75);
      g.quadraticCurveTo(0, s * 0.9, -s * 0.28, s * 0.75);
      g.lineTo(-s * 0.35, 0.1 * s);
      g.closePath();
      g.fillStyle = '#F0E4CE';
      g.fill();
      endShadow();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      g.strokeStyle = 'rgba(160,120,80,.8)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(-s, 0.1 * s);
      g.lineTo(s, 0.1 * s);
      g.stroke();

      if (d > 0.5) {
        g.fillStyle = 'rgba(150,100,50,.35)';
        g.beginPath();
        g.arc(-s * 0.4, -s * 0.35, s * 0.18, 0, TAU);
        g.fill();
      }
    } else if (t.type === 'jalap') {
      g.beginPath();
      g.arc(0, 0, s, 0, TAU);
      g.fillStyle = '#4F7A38';
      g.fill();
      endShadow();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      g.beginPath();
      g.arc(0, 0, s * 0.52, 0, TAU);
      g.fillStyle = '#DCE8C2';
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.3;
      g.stroke();

      g.strokeStyle = 'rgba(255,255,255,.4)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(0, 0, s * 0.76, -2.6, -1.4);
      g.stroke();
    } else if (t.type === 'basil') {
      g.beginPath();
      g.moveTo(0, -s);
      g.quadraticCurveTo(s * 0.85, -s * 0.3, 0, s);
      g.quadraticCurveTo(-s * 0.85, -s * 0.3, 0, -s);
      g.closePath();
      g.fillStyle = '#57863F';
      g.fill();
      endShadow();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      g.strokeStyle = 'rgba(240,250,220,.7)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(0, -s * 0.8);
      g.quadraticCurveTo(s * 0.08, 0, 0, s * 0.8);
      g.stroke();

      if (d > 0.45) {
        g.fillStyle = 'rgba(90,60,20,.35)';
        g.beginPath();
        g.arc(s * 0.2, s * 0.35, s * 0.14, 0, TAU);
        g.fill();
      }
    } else if (t.type === 'chick') {
      // Grilled golden roasted chicken chunk
      g.beginPath();
      g.moveTo(-s * 0.9, -s * 0.3);
      g.quadraticCurveTo(-s * 0.4, -s * 0.9, s * 0.5, -s * 0.6);
      g.quadraticCurveTo(s * 1.05, 0, s * 0.7, s * 0.6);
      g.quadraticCurveTo(0, s * 0.95, -s * 0.8, s * 0.4);
      g.closePath();
      g.fillStyle = '#E4BA81';
      g.fill();
      endShadow();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      // Grill mark lines
      g.strokeStyle = 'rgba(110, 48, 16, 0.75)';
      g.lineWidth = s * 0.14;
      g.beginPath();
      g.moveTo(-s * 0.4, -s * 0.45);
      g.lineTo(-s * 0.15, s * 0.4);
      g.moveTo(0.1, -s * 0.45);
      g.lineTo(0.35, s * 0.4);
      g.stroke();

      // Herb specks
      g.fillStyle = '#3E662D';
      g.beginPath();
      g.arc(-s * 0.2, 0, s * 0.08, 0, TAU);
      g.arc(s * 0.25, -s * 0.15, s * 0.07, 0, TAU);
      g.arc(0, s * 0.2, s * 0.06, 0, TAU);
      g.fill();
    } else if (t.type === 'onion') {
      // Sweet caramelized onion ribbon
      g.beginPath();
      g.arc(0, 0, s * 0.85, -0.6, 2.4);
      g.arc(s * 0.15, s * 0.1, s * 0.7, 2.3, -0.5, true);
      g.closePath();
      g.fillStyle = '#C47E5A';
      g.fill();
      endShadow();
      g.strokeStyle = INK;
      g.lineWidth = 1.6;
      g.stroke();

      g.strokeStyle = 'rgba(255, 230, 200, 0.6)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(0, 0, s * 0.75, -0.4, 2.1);
      g.stroke();
    } else {
      // Olive
      g.beginPath();
      g.arc(0, 0, s, 0, TAU);
      g.fillStyle = '#3B2C26';
      g.fill();
      endShadow();
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.stroke();

      g.beginPath();
      g.arc(0, 0, s * 0.45, 0, TAU);
      g.fillStyle = '#6B342A';
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.4;
      g.stroke();

      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(0, 0, s * 0.72, -2.4, -1.2);
      g.stroke();
    }

    // Molten cheese oozing over the edges so toppings sit *in* the pizza (fresh basil stays on top)
    if (melt > 0 && t.type !== 'basil') {
      const look = eng.cheeseLook;
      g.globalAlpha = melt;
      const n = 2 + (jitter > 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = t.rot * 2.3 + i * 2.2 + jitter;
        const ox = Math.cos(a) * s * 0.9;
        const oy = Math.sin(a) * s * 0.9;
        const r = s * (0.26 + 0.08 * Math.sin(a * 3.1));
        g.beginPath();
        g.ellipse(ox, oy, r * 1.25, r * 0.85, a + Math.PI / 2, 0, TAU);
        g.fillStyle = look.body;
        g.fill();
        g.strokeStyle = look.edge;
        g.lineWidth = 1.2;
        g.stroke();
        g.fillStyle = 'rgba(255,253,240,.8)';
        g.beginPath();
        g.arc(ox - r * 0.3, oy - r * 0.25, r * 0.22, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.restore();
  };

  const paintPizzaLayers = (g: CanvasRenderingContext2D, px: number, py: number) => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    const currentCrust = optionsRef.current.state.crustId;
    const currentSize = optionsRef.current.state.sizeId;
    const sig = `${currentCrust}|${currentSize}|${Math.round(eng.doneness * 50)}|${Math.round(
      eng.R * 2
    )}`;

    if (sig !== eng.baseKey) {
      eng.baseKey = sig;
      buildBase();
    }

    const ox = px - eng.cx;
    const oy = py - eng.cy;
    g.drawImage(offscreenRef.current.baseC, ox, oy, eng.W, eng.H);

    const inn = innerFrac();
    const d = eng.doneness;

    if (eng.sauce.length) {
      g.save();
      drawOrganicPath(g, px, py, eng.R * inn * 0.99, 0.042);
      g.clip();
      g.drawImage(offscreenRef.current.sauceC, ox, oy, eng.W, eng.H);
      g.restore();
    }

    // Re-render the cheese as it melts and browns in the oven
    const meltKey = Math.round(clamp(d, 0, 1.2) * 25);
    if (meltKey !== eng.cheeseMeltKey) {
      eng.cheeseMeltKey = meltKey;
      repaintCheese();
    }

    if (eng.cheese.length) {
      g.save();
      drawOrganicPath(g, px, py, eng.R * inn, 0.042);
      g.clip();
      g.drawImage(offscreenRef.current.cheeseC, ox, oy, eng.W, eng.H);
      g.restore();
    }

    // Golden-brown blistered spots where cheese bubbles popped in the oven
    for (const t of eng.toastSpots) {
      const rr = t.r * eng.R * inn * 2.4;
      const x = px + t.x * eng.R * inn;
      const y = py + t.y * eng.R * inn;
      const grad = g.createRadialGradient(x, y, 0, x, y, rr);
      grad.addColorStop(0, 'rgba(160,78,20,0.55)');
      grad.addColorStop(0.5, 'rgba(204,120,38,0.35)');
      grad.addColorStop(1, 'rgba(214,140,50,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rr, 0, TAU);
      g.fill();
    }

    for (const m of eng.mirror) {
      drawTopping(g, m, px + m.x * eng.R * inn, py + m.y * eng.R * inn, d);
    }
  };

  /** Soft contact shadow so the pizza sits on the board instead of blending into it */
  const drawPizzaShadow = (ctx: CanvasRenderingContext2D, px: number, py: number) => {
    const eng = engineRef.current;
    ctx.fillStyle = 'rgba(40,20,6,0.16)';
    drawOrganicPath(ctx, px + 5, py + 10, eng.R * 1.03, 0.048);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,20,6,0.2)';
    drawOrganicPath(ctx, px + 2, py + 5, eng.R * 1.005, 0.048);
    ctx.fill();
  };

  const drawPizzaFull = (ctx: CanvasRenderingContext2D, px: number, py: number) => {
    const eng = engineRef.current;
    paintPizzaLayers(ctx, px, py);
    const inn = innerFrac();
    for (const b of eng.bubbles) {
      const k = b.t / 1.4;
      const rr = b.r * easeOutQuad(Math.min(1, k * 1.4));
      const al = k < 0.75 ? 0.55 : 0.55 * (1 - (k - 0.75) / 0.25);
      ctx.fillStyle = `rgba(255,246,220,${al.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px + b.x * eng.R * inn, py + b.y * eng.R * inn, rr, 0, TAU);
      ctx.fill();
    }
  };

  /** Trace knife blade cut points from center (cx, cy) outward to radius rMax with organic hand-cut waviness */
  const traceCutPoints = (
    cx: number,
    cy: number,
    a: number,
    rMax: number,
    _wobble: number = 0.048,
    reverse: boolean = false
  ) => {
    const steps = 14;
    const pts: { x: number; y: number }[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const rCurrent = rMax * t;
      // Authentic micro-waviness of an artisan hand-cut rocking blade
      const waviness = Math.sin(t * Math.PI * 3.5 + a * 3) * 1.5;
      const nx = -Math.sin(a) * waviness;
      const ny = Math.cos(a) * waviness;
      pts.push({
        x: cx + Math.cos(a) * rCurrent + nx,
        y: cy + Math.sin(a) * rCurrent + ny
      });
    }
    return reverse ? pts.reverse() : pts;
  };

  /** Build organic slice wedge path using the unified cut trace helper */
  const buildSliceWedge = (
    g: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    a0: number,
    a1: number,
    wobble: number = 0.048
  ) => {
    const eng = engineRef.current;
    const r0 = organicR(a0, eng.R, wobble);
    const r1 = organicR(a1, eng.R, wobble);

    g.beginPath();
    // 1. Ray along a0 from center to crust
    const ptsA0 = traceCutPoints(cx, cy, a0, r0, wobble);
    g.moveTo(ptsA0[0].x, ptsA0[0].y);
    for (let i = 1; i < ptsA0.length; i++) {
      g.lineTo(ptsA0[i].x, ptsA0[i].y);
    }

    // 2. Outer crust arc from a0 to a1
    const arcSteps = 14;
    for (let s = 1; s <= arcSteps; s++) {
      const a = a0 + ((a1 - a0) * s) / arcSteps;
      const rCurrent = organicR(a, eng.R, wobble);
      g.lineTo(cx + Math.cos(a) * rCurrent, cy + Math.sin(a) * rCurrent);
    }

    // 3. Ray along a1 from crust back to center
    const ptsA1Rev = traceCutPoints(cx, cy, a1, r1, wobble, true);
    for (const p of ptsA1Rev) {
      g.lineTo(p.x, p.y);
    }

    g.closePath();
  };

  /** Render finished review pizza with authentic artisan knife cuts and one hero slice pulled out (commercial ad style) */
  const drawReviewSeparatedSlices = (ctx: CanvasRenderingContext2D, px: number, py: number) => {
    if (!offscreenRef.current) return;
    const eng = engineRef.current;
    const inn = innerFrac();

    // 8 slices with subtle natural hand-cut jitter
    const SLICES = 8;
    const CUT_JITTERS = [0.02, -0.015, 0.025, -0.02, 0.015, -0.022, 0.02, -0.012];
    const HERO_SLICE = 5; // Top-left slice (~10:30 clock position) pulled out as in ads

    // Calculate angle boundaries for all slices
    const sliceAngles: { a0: number; a1: number; midA: number }[] = [];
    for (let i = 0; i < SLICES; i++) {
      const a0 = (i * TAU) / SLICES + CUT_JITTERS[i];
      const a1 = ((i + 1) * TAU) / SLICES + CUT_JITTERS[(i + 1) % SLICES];
      sliceAngles.push({ a0, a1, midA: (a0 + a1) / 2 });
    }

    const hero = sliceAngles[HERO_SLICE];
    // Hero slice offset: pulled out ~38px along its radial vector
    const heroDisp = 38;
    const heroDx = Math.cos(hero.midA) * heroDisp;
    const heroDy = Math.sin(hero.midA) * heroDisp;

    const r0 = organicR(hero.a0, eng.R, 0.048);
    const r1 = organicR(hero.a1, eng.R, 0.048);

    // ── 1. Contact shadow for the pulled hero slice on the cutting board ──
    ctx.save();
    buildSliceWedge(ctx, px + heroDx + 3, py + heroDy + 6, hero.a0, hero.a1, 0.048);
    ctx.fillStyle = 'rgba(28, 14, 5, 0.24)';
    ctx.fill();
    ctx.restore();

    // ── 2. Render Main Pizza Body (all slices EXCEPT hero) ──
    // Uses the identical wavy cut rays so the hero slice fits the gap like a puzzle piece
    ctx.save();
    ctx.beginPath();
    const ptsBodyCut1 = traceCutPoints(px, py, hero.a1, r1, 0.048);
    ctx.moveTo(ptsBodyCut1[0].x, ptsBodyCut1[0].y);
    for (let i = 1; i < ptsBodyCut1.length; i++) {
      ctx.lineTo(ptsBodyCut1[i].x, ptsBodyCut1[i].y);
    }

    const bodyArcSteps = 48;
    for (let s = 1; s <= bodyArcSteps; s++) {
      const a = hero.a1 + ((TAU - (hero.a1 - hero.a0)) * s) / bodyArcSteps;
      const rad = organicR(a, eng.R, 0.048);
      ctx.lineTo(px + Math.cos(a) * rad, py + Math.sin(a) * rad);
    }

    const ptsBodyCut0Rev = traceCutPoints(px, py, hero.a0, r0, 0.048, true);
    for (const p of ptsBodyCut0Rev) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.clip();
    drawPizzaFull(ctx, px, py);
    ctx.restore();

    // ── 3. Render Pulled Hero Slice at (px + heroDx, py + heroDy) ──
    ctx.save();
    buildSliceWedge(ctx, px + heroDx, py + heroDy, hero.a0, hero.a1, 0.048);
    ctx.clip();
    drawPizzaFull(ctx, px + heroDx, py + heroDy);
    ctx.restore();

    // Outer crust ink stroke for hero slice
    ctx.save();
    ctx.beginPath();
    const heroArcSteps = 14;
    for (let s = 0; s <= heroArcSteps; s++) {
      const a = hero.a0 + ((hero.a1 - hero.a0) * s) / heroArcSteps;
      const rad = organicR(a, eng.R, 0.048);
      const sx = px + heroDx + Math.cos(a) * rad;
      const sy = py + heroDy + Math.sin(a) * rad;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();

    // Outer crust ink stroke for main pizza body perimeter
    ctx.save();
    ctx.beginPath();
    for (let s = 0; s <= bodyArcSteps; s++) {
      const a = hero.a1 + ((TAU - (hero.a1 - hero.a0)) * s) / bodyArcSteps;
      const rad = organicR(a, eng.R, 0.048);
      const sx = px + Math.cos(a) * rad;
      const sy = py + Math.sin(a) * rad;
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();

    // ── 4. Exposed Cut Edges (organic hand-drawn ink line + subtle cornicione depth) ──
    ctx.save();
    const drawOrganicCutEdge = (ox: number, oy: number, a: number, rMax: number) => {
      const pts = traceCutPoints(ox, oy, a, rMax, 0.048);

      // Fine doodle ink boundary line following the exact knife cut
      ctx.strokeStyle = 'rgba(51, 36, 26, 0.40)';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // Soft warm baked crumb cross-section depth (only along the puffy crust rim)
      const innStart = Math.floor(pts.length * inn * 0.95);
      if (innStart < pts.length - 1) {
        ctx.strokeStyle = 'rgba(170, 110, 45, 0.32)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(pts[innStart].x, pts[innStart].y);
        for (let i = innStart + 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
    };

    // Soft cutting board shadow in the lifted wedge gap
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (const p of ptsBodyCut1) ctx.lineTo(p.x, p.y);
    for (const p of ptsBodyCut0Rev) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(25, 12, 4, 0.12)';
    ctx.fill();

    // Exposed cut edges on main pizza body
    drawOrganicCutEdge(px, py, hero.a0, r0);
    drawOrganicCutEdge(px, py, hero.a1, r1);

    // Exposed cut edges on pulled hero slice
    drawOrganicCutEdge(px + heroDx, py + heroDy, hero.a0, r0);
    drawOrganicCutEdge(px + heroDx, py + heroDy, hero.a1, r1);
    ctx.restore();

    // ── 5. Knife cut grooves between the remaining 7 slices on the main pizza ──
    ctx.save();
    for (let i = 0; i < SLICES; i++) {
      if (i === HERO_SLICE || (i + 1) % SLICES === HERO_SLICE) continue;
      const a = sliceAngles[i].a1;
      const rOuter = organicR(a, eng.R, 0.048);
      const pts = traceCutPoints(px, py, a, rOuter, 0.048);
      const rimIdx = Math.floor(pts.length * inn);

      // Crust rim incision: crisp rocker blade score notch across baked crust
      ctx.strokeStyle = 'rgba(65, 30, 10, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pts[rimIdx].x, pts[rimIdx].y);
      for (let s = rimIdx + 1; s < pts.length; s++) {
        ctx.lineTo(pts[s].x, pts[s].y);
      }
      ctx.stroke();

      // Cheese & topping center incision: soft, interrupted knife crease through gooey cheese
      ctx.setLineDash([12, 5, 18, 6]);
      ctx.strokeStyle = 'rgba(55, 25, 10, 0.20)';
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.moveTo(pts[1].x, pts[1].y);
      for (let s = 2; s <= rimIdx; s++) {
        ctx.lineTo(pts[s].x, pts[s].y);
      }
      ctx.stroke();

      // Delicate warm melted cheese glimmer along the cut seam
      ctx.strokeStyle = 'rgba(255, 245, 210, 0.30)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(pts[2].x + 0.6, pts[2].y - 0.6);
      for (let s = 3; s < rimIdx; s++) {
        ctx.lineTo(pts[s].x + 0.6, pts[s].y - 0.6);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // ── 6. Melted Mozzarella Cheese Pull (Commercial Ad Style with Multi-Anchor Tension) ──
    ctx.save();
    const units = optionsRef.current.state.cheeseUnits || 1;
    const extraWidth = Math.min(2.8, (units - 1) * 0.35);
    const look = eng.cheeseLook;

    // Multi-point cheese pull anchors:
    // Left flank bridge: stretching across the left gap between hero flank & main body
    // Center apex ribbons: gooey melted cheese pulling from the tip
    // Right flank bridge: stretching across the right gap between hero flank & main body
    const cheesePullStrands = [
      // 1. Left flank stretch
      {
        p1: {
          x: px + heroDx + Math.cos(hero.a0) * (eng.R * 0.24),
          y: py + heroDy + Math.sin(hero.a0) * (eng.R * 0.24)
        },
        p2: {
          x: px + Math.cos(hero.a0) * (eng.R * 0.2),
          y: py + Math.sin(hero.a0) * (eng.R * 0.2)
        },
        sagX: 3,
        sagY: 4,
        w: 2.2 + extraWidth * 0.7,
        phase: 0.2,
        hasBead: true
      },
      // 2. Center apex primary ribbon (tip to center)
      {
        p1: { x: px + heroDx - 2, y: py + heroDy + 1 },
        p2: { x: px + Math.cos(hero.midA) * 3, y: py + Math.sin(hero.midA) * 3 },
        sagX: -2,
        sagY: 6,
        w: 2.8 + extraWidth,
        phase: 0.5,
        hasBead: true
      },
      // 3. Center apex secondary stretch
      {
        p1: { x: px + heroDx + 2, y: py + heroDy - 2 },
        p2: { x: px + Math.cos(hero.midA) * 7 - 1, y: py + Math.sin(hero.midA) * 7 - 1 },
        sagX: 2,
        sagY: 5,
        w: 2.0 + extraWidth * 0.8,
        phase: 0.8,
        hasBead: false
      },
      // 4. Right flank stretch
      {
        p1: {
          x: px + heroDx + Math.cos(hero.a1) * (eng.R * 0.24),
          y: py + heroDy + Math.sin(hero.a1) * (eng.R * 0.24)
        },
        p2: {
          x: px + Math.cos(hero.a1) * (eng.R * 0.2),
          y: py + Math.sin(hero.a1) * (eng.R * 0.2)
        },
        sagX: -3,
        sagY: 4,
        w: 2.2 + extraWidth * 0.7,
        phase: 1.1,
        hasBead: true
      }
    ];

    if (units >= 3) {
      cheesePullStrands.push({
        p1: { x: px + heroDx - 4, y: py + heroDy + 3 },
        p2: { x: px + Math.cos(hero.midA) * 5, y: py + Math.sin(hero.midA) * 5 },
        sagX: -4,
        sagY: 7,
        w: 1.8 + extraWidth * 0.5,
        phase: 1.4,
        hasBead: false
      });
    }
    if (units >= 5) {
      cheesePullStrands.push({
        p1: { x: px + heroDx + 4, y: py + heroDy - 1 },
        p2: { x: px + Math.cos(hero.midA) * 8, y: py + Math.sin(hero.midA) * 8 },
        sagX: 4,
        sagY: 8,
        w: 2.0 + extraWidth * 0.5,
        phase: 1.7,
        hasBead: true
      });
    }

    for (const st of cheesePullStrands) {
      // Gooey strands: thick where they leave the cheese, stretched thin and sagging in the middle
      const w = st.w * 1.6;
      const cpx = (st.p1.x + st.p2.x) * 0.5 + st.sagX + Math.sin(eng.time * 2.2 + st.phase) * 1.2;
      const cpy =
        (st.p1.y + st.p2.y) * 0.5 + st.sagY * 1.6 + Math.cos(eng.time * 2.2 + st.phase) * 1.0;
      const STEPS = 40;
      const strand: { x: number; y: number; r: number }[] = [];
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS;
        const u = 1 - t;
        const taper = 0.32 + 0.68 * Math.pow(Math.abs(2 * t - 1), 1.6);
        strand.push({
          x: u * u * st.p1.x + 2 * u * t * cpx + t * t * st.p2.x,
          y: u * u * st.p1.y + 2 * u * t * cpy + t * t * st.p2.y,
          r: (w * taper) / 2
        });
      }
      ctx.fillStyle = rgbaHex(look.edge, 0.7);
      ctx.beginPath();
      for (const q of strand) {
        ctx.moveTo(q.x + q.r + 0.9, q.y);
        ctx.arc(q.x, q.y, q.r + 0.9, 0, TAU);
      }
      ctx.fill();
      ctx.fillStyle = look.body;
      ctx.beginPath();
      for (const q of strand) {
        ctx.moveTo(q.x + q.r, q.y);
        ctx.arc(q.x, q.y, q.r, 0, TAU);
      }
      ctx.fill();

      // Glossy highlight along the strand
      ctx.strokeStyle = 'rgba(255, 255, 245, 0.85)';
      ctx.lineWidth = Math.max(0.8, w * 0.16);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 2; i <= STEPS - 2; i++) {
        const q = strand[i];
        if (i === 2) ctx.moveTo(q.x - q.r * 0.4, q.y - q.r * 0.4);
        else ctx.lineTo(q.x - q.r * 0.4, q.y - q.r * 0.4);
      }
      ctx.stroke();

      // Molten cheese droplet suspended mid-stretch
      if (st.hasBead) {
        // Drip hanging from the lowest point of the strand
        const mid = strand[STEPS / 2];
        ctx.fillStyle = look.body;
        ctx.strokeStyle = rgbaHex(look.edge, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(mid.x, mid.y + mid.r + w * 0.25, w * 0.22, w * 0.34, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── 7. Rustic Board Garnishes (scattered fresh herbs & toasted crumbs on wood board) ──
    ctx.save();
    const garnishes = [
      { a: -1.75, d: 0.38, r: 2.2, c: 'rgba(56, 128, 48, 0.75)' },
      { a: -2.25, d: 0.44, r: 1.8, c: 'rgba(68, 145, 58, 0.70)' },
      { a: 0.65, d: 0.32, r: 1.5, c: 'rgba(180, 100, 35, 0.65)' },
      { a: 2.15, d: 0.36, r: 2.0, c: 'rgba(195, 120, 45, 0.60)' },
      { a: -0.35, d: 0.28, r: 1.6, c: 'rgba(60, 135, 52, 0.70)' },
      // Rustic toasted crumbs on cutting board in the gap:
      { a: hero.midA + 0.08, d: 0.22, r: 1.5, c: 'rgba(185, 120, 40, 0.60)' },
      { a: hero.midA - 0.09, d: 0.28, r: 1.8, c: 'rgba(65, 140, 55, 0.65)' }
    ];
    for (const g of garnishes) {
      ctx.fillStyle = g.c;
      ctx.beginPath();
      ctx.arc(px + Math.cos(g.a) * eng.R * g.d, py + Math.sin(g.a) * eng.R * g.d, g.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawZoneOverlay = (ctx: CanvasRenderingContext2D) => {
    const z = optionsRef.current.state.zone;
    if (z === 'whole') return;
    const eng = engineRef.current;
    ctx.save();
    blobPath(ctx, eng.cx, eng.cy, 1, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(244,235,218,0.42)';
    ctx.fillRect(z === 'left' ? eng.cx : eng.cx - eng.R, eng.cy - eng.R, eng.R, eng.R * 2);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(51,36,26,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(eng.cx, eng.cy - eng.R);
    ctx.lineTo(eng.cx, eng.cy + eng.R);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

  const drawDoughStage = (ctx: CanvasRenderingContext2D) => {
    const eng = engineRef.current;
    const rb = lerp(eng.R * 0.38, eng.R * 0.98, easeOutQuad(eng.spread));
    const x = eng.cx;
    let y = eng.cy + Math.sin(eng.time * 2.2) * 2;
    let rot = 0;
    let sx = 1;
    let sy = 1;

    if (eng.toss.on) {
      const t = eng.toss.t;
      if (t < 0.5) {
        const p = easeOutQuad(t / 0.5);
        y = eng.cy - p * eng.R * 1.6;
        rot = p * 3.6;
        sy = 1 + p * 0.18;
        sx = 1 - p * 0.08;
      } else if (t < 0.8) {
        const p = (t - 0.5) / 0.3;
        y = eng.cy - eng.R * 1.6 - Math.sin(p * Math.PI) * eng.R * 0.15;
        rot = 3.6 + p * 0.6;
        sy = 1.18;
        sx = 0.92;
      } else if (t < 1.15) {
        const p = easeInQuad((t - 0.8) / 0.35);
        y = eng.cy - eng.R * 1.6 * (1 - p);
        rot = 4.2 + p * 2.2;
        sy = 1.18 - p * 0.18;
        sx = 0.92 + p * 0.08;
      } else {
        const p = Math.min(1, (t - 1.15) / 0.4);
        const b = Math.sin(p * Math.PI * 2) * Math.exp(-p * 3) * 0.18;
        sy = 1 - b;
        sx = 1 + b * 0.7;
        rot = 6.4;
        y = eng.cy;
      }
      if (!eng.toss.landed && t >= 1.15) {
        eng.toss.landed = true;
        eng.shake = 1;
        flourBurst(eng.cx, eng.cy + rb * 0.4, 10);
        SND.thud();
        vib(30);
      }
    }

    const air = clamp((eng.cy - y) / (eng.R * 1.6), 0, 1);
    ctx.fillStyle = 'rgba(58,38,20,.16)';
    ctx.beginPath();
    ctx.ellipse(
      eng.cx + 3,
      eng.cy + rb * 0.55,
      rb * (1 - air * 0.5),
      rb * 0.3 * (1 - air * 0.4),
      0,
      0,
      TAU
    );
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sx, sy);

    const g = ctx.createRadialGradient(-rb * 0.35, -rb * 0.4, rb * 0.1, 0, 0, rb * 1.05);
    g.addColorStop(0, '#F6E9C9');
    g.addColorStop(0.6, '#EBD5A8');
    g.addColorStop(1, '#CFAC79');

    // Organic hand-kneaded dough base
    drawOrganicPath(ctx, 0, 0, rb, 0.052);
    ctx.fillStyle = g;
    ctx.fill();

    // Distinct visual crust rim representation for Thin, Pan, and Cheese Stuffed
    const crustType = optionsRef.current.state.crustId;
    const rimWidth =
      crustType === 'stuffed' ? rb * 0.22 : crustType === 'pan' ? rb * 0.16 : rb * 0.08;
    const rimColor =
      crustType === 'stuffed' ? '#E5C07B' : crustType === 'pan' ? '#D6A665' : '#CFAC79';

    if (crustType === 'stuffed') {
      // 1. Stuffed Crust: Plump continuous hand-rolled cornicione with flour dusting (NO beads!)
      // Warm dough rim ring
      drawOrganicPath(ctx, 0, 0, rb - rimWidth * 0.5, 0.045);
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = rimWidth * 0.88;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Soft flour sheen along the upper ridge of the cornicione
      drawOrganicPath(ctx, 0, 0, rb - rimWidth * 0.46, 0.042);
      ctx.strokeStyle = 'rgba(255, 252, 242, 0.6)';
      ctx.lineWidth = rimWidth * 0.42;
      ctx.stroke();

      // Subtle hand-crimped dough fold pleats
      const pleats = 14;
      for (let i = 0; i < pleats; i++) {
        const a = (i / pleats) * TAU + Math.sin(i * 1.7) * 0.08;
        const pinchR0 = organicR(a, rb - rimWidth, 0.04);
        const pinchR1 = organicR(a, rb - 2, 0.048);
        const midA = a + 0.04;
        ctx.strokeStyle = 'rgba(105, 65, 30, 0.28)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * pinchR0, Math.sin(a) * pinchR0);
        ctx.quadraticCurveTo(
          Math.cos(midA) * (pinchR0 + pinchR1) * 0.5,
          Math.sin(midA) * (pinchR0 + pinchR1) * 0.5,
          Math.cos(a) * pinchR1,
          Math.sin(a) * pinchR1
        );
        ctx.stroke();
      }
    } else if (crustType === 'pan') {
      // 2. Pan Crust: Thick, pillowy deep-dish dough rim
      drawOrganicPath(ctx, 0, 0, rb - rimWidth * 0.5, 0.042);
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = rimWidth;
      ctx.stroke();

      // Soft golden thumb dimples along the rim
      ctx.strokeStyle = 'rgba(175, 110, 45, 0.3)';
      ctx.lineWidth = 3.5;
      drawOrganicPath(ctx, 0, 0, rb - rimWidth * 0.45, 0.04);
      ctx.stroke();
    } else {
      // 3. Thin Crust: Delicate hand-stretched rim with fine flour dusting
      drawOrganicPath(ctx, 0, 0, rb - rimWidth * 0.5, 0.048);
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = rimWidth;
      ctx.stroke();
    }

    // Inner ridge crease (organic)
    drawOrganicPath(ctx, 0, 0, rb - rimWidth, 0.045);
    ctx.strokeStyle = 'rgba(92, 58, 26, 0.26)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hand-drawn ink contour for dough
    drawOrganicPath(ctx, 0, 0, rb, 0.052);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(140,100,55,0.35)';
    ctx.lineWidth = 1.5;
    for (const dm of STATIC_DOUGH_DIMPLES) {
      ctx.beginPath();
      ctx.arc(Math.cos(dm.a) * dm.d * rb, Math.sin(dm.a) * dm.d * rb, dm.r * rb, 0.3, 2.4);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawWoodLog = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    angle: number,
    fl: number
  ) => {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(angle);

    // Charcoal wood body
    ctx.fillStyle = '#1D0C05';
    rrPath(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fill();

    // Wood bark texture lines
    ctx.strokeStyle = '#2B1408';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 10, -h * 0.15);
    ctx.lineTo(w / 2 - 12, -h * 0.15);
    ctx.moveTo(-w / 2 + 16, h * 0.2);
    ctx.lineTo(w / 2 - 18, h * 0.2);
    ctx.stroke();

    // Fiery glowing cracks/fissures pulsing with internal heat
    ctx.strokeStyle = `rgba(255, 185, 45, ${0.85 * fl})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.05);
    ctx.lineTo(-w * 0.05, h * 0.1);
    ctx.lineTo(w * 0.28, -h * 0.1);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 65, 0, ${0.75 * fl})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, h * 0.2);
    ctx.lineTo(w * 0.1, h * 0.22);
    ctx.lineTo(w * 0.35, h * 0.12);
    ctx.stroke();

    ctx.restore();
  };

  const drawWoodFiredFireplace = (ctx: CanvasRenderingContext2D, behindPizza: boolean) => {
    const eng = engineRef.current;
    if (!eng.W || !eng.H) return;

    // Organic fire flicker calculation with multiple harmonic frequencies
    const fl =
      0.85 +
      Math.sin(eng.time * 8.5) * 0.08 +
      Math.sin(eng.time * 19.2) * 0.04 +
      Math.sin(eng.time * 31.8) * 0.03;
    const isPeak = eng.doneness >= 0.72 && eng.doneness < 0.86;
    const isBurnt = eng.doneness >= 0.86;
    const intensity = isBurnt ? 1.35 : isPeak ? 1.2 : 1.0;

    const hearthY = eng.H - 28;

    if (behindPizza) {
      // 1. Warm Ambient Illumination Wash on Chamber & Bricks
      // Massive radial hearth fire glow from the bottom
      const rg = ctx.createRadialGradient(
        eng.cx,
        eng.H + 15,
        eng.R * 0.15,
        eng.cx,
        eng.H * 0.65,
        eng.H * 1.2
      );
      rg.addColorStop(0, `rgba(255, 155, 30, ${0.48 * fl * intensity})`);
      rg.addColorStop(0.35, `rgba(255, 80, 10, ${0.28 * fl * intensity})`);
      rg.addColorStop(0.7, `rgba(210, 45, 0, ${0.12 * fl * intensity})`);
      rg.addColorStop(1, 'rgba(180, 30, 0, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, eng.W, eng.H);

      // Whole-chamber warm amber air wash (makes the brick atmosphere feel cozy & baking hot)
      const ambientWash = ctx.createLinearGradient(0, eng.H, 0, 0);
      ambientWash.addColorStop(0, `rgba(255, 115, 20, ${0.22 * fl * intensity})`);
      ambientWash.addColorStop(0.5, `rgba(245, 95, 15, ${0.11 * fl})`);
      ambientWash.addColorStop(1, 'rgba(180, 45, 5, 0.04)');
      ctx.fillStyle = ambientWash;
      ctx.fillRect(0, 0, eng.W, eng.H);

      // 2. Convection Heat Mirage Waves
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 7; i++) {
        const sx = eng.cx + (i - 3) * (eng.W * 0.14);
        ctx.strokeStyle = `rgba(255, 190, 85, ${0.11 * fl})`;
        ctx.beginPath();
        for (let yy = eng.H; yy > 10; yy -= 10) {
          const off = Math.sin(yy * 0.038 - eng.time * 5.5 + i * 1.8) * (5 + (eng.H - yy) * 0.015);
          if (yy === eng.H) ctx.moveTo(sx + off, yy);
          else ctx.lineTo(sx + off, yy);
        }
        ctx.stroke();
      }

      // 3. Glowing Coal Bed at Hearth Base
      const coalGlow = ctx.createLinearGradient(0, hearthY - 18, 0, eng.H);
      coalGlow.addColorStop(0, `rgba(255, 195, 45, ${0.85 * fl * intensity})`);
      coalGlow.addColorStop(0.35, `rgba(255, 85, 10, ${0.92 * fl * intensity})`);
      coalGlow.addColorStop(0.75, 'rgba(195, 25, 0, 0.95)');
      coalGlow.addColorStop(1, 'rgba(120, 10, 0, 0.98)');
      ctx.fillStyle = coalGlow;
      ctx.fillRect(0, hearthY - 14, eng.W, eng.H - (hearthY - 14));

      // 4. Wood Logs on the Hearth
      drawWoodLog(ctx, eng.W * 0.04, hearthY + 2, eng.W * 0.38, 22, -0.06, fl);
      drawWoodLog(ctx, eng.W * 0.26, hearthY - 4, eng.W * 0.48, 24, 0.02, fl);
      drawWoodLog(ctx, eng.W * 0.58, hearthY + 3, eng.W * 0.38, 22, 0.05, fl);

      // 5. Procedural Roaring Flame Tongues (Rear & Mid Layers)
      // Layer A: Deep Red / Crimson Back Flames (Tallest, roaring up to ~220px)
      const tongueCount = 14;
      for (let i = 0; i < tongueCount; i++) {
        const u = i / (tongueCount - 1);
        const bx = -20 + u * (eng.W + 40);
        // Flames are taller on the sides to frame the oven dome
        const sideFactor = 1 + Math.pow(Math.abs(u - 0.5) * 2, 1.4) * 0.45;
        const phase = i * 2.37;
        const baseH = (95 + (i % 3) * 28) * sideFactor * (isPeak ? 1.2 : 1.0);
        const h =
          baseH +
          Math.sin(eng.time * 6.8 + phase) * 24 +
          Math.sin(eng.time * 15.2 + phase * 1.5) * 12;
        const sway = Math.sin(eng.time * 4.2 + phase) * 18 + Math.cos(eng.time * 9.5 + phase) * 6;
        const tipX = bx + sway;
        const tipY = hearthY - h;
        const bw = (38 + (i % 2) * 14) * sideFactor;

        const fg = ctx.createLinearGradient(bx, hearthY, tipX, tipY);
        fg.addColorStop(0, `rgba(255, 125, 20, ${0.95 * intensity})`);
        fg.addColorStop(0.35, `rgba(235, 55, 0, ${0.88 * intensity})`);
        fg.addColorStop(0.7, 'rgba(180, 20, 0, 0.65)');
        fg.addColorStop(1, 'rgba(140, 10, 0, 0)');

        ctx.beginPath();
        ctx.moveTo(bx - bw * 0.5, hearthY);
        ctx.quadraticCurveTo(bx - bw * 0.3 + sway * 0.4, hearthY - h * 0.55, tipX, tipY);
        ctx.quadraticCurveTo(
          bx + bw * 0.3 + sway * 0.4,
          hearthY - h * 0.55,
          bx + bw * 0.5,
          hearthY
        );
        ctx.closePath();
        ctx.fillStyle = fg;
        ctx.fill();
      }

      // Layer B: Mid Flames (Vibrant Blazing Orange & Amber Gold, heights 70-150px)
      const midCount = 16;
      for (let i = 0; i < midCount; i++) {
        const u = i / (midCount - 1);
        const bx = -10 + u * (eng.W + 20);
        const phase = i * 3.14 + 1.2;
        const baseH = (65 + (i % 4) * 22) * (isPeak ? 1.22 : 1.0);
        const h =
          baseH +
          Math.sin(eng.time * 8.2 + phase) * 20 +
          Math.sin(eng.time * 18.1 + phase * 1.8) * 10;
        const sway = Math.sin(eng.time * 5.5 + phase) * 14;
        const tipX = bx + sway;
        const tipY = hearthY - h;
        const bw = 30 + (i % 3) * 10;

        const fg = ctx.createLinearGradient(bx, hearthY, tipX, tipY);
        fg.addColorStop(0, 'rgba(255, 220, 50, 0.98)');
        fg.addColorStop(0.35, 'rgba(255, 125, 15, 0.92)');
        fg.addColorStop(0.75, 'rgba(235, 45, 0, 0.65)');
        fg.addColorStop(1, 'rgba(190, 15, 0, 0)');

        ctx.beginPath();
        ctx.moveTo(bx - bw * 0.5, hearthY);
        ctx.quadraticCurveTo(bx - bw * 0.25 + sway * 0.35, hearthY - h * 0.5, tipX, tipY);
        ctx.quadraticCurveTo(
          bx + bw * 0.25 + sway * 0.35,
          hearthY - h * 0.5,
          bx + bw * 0.5,
          hearthY
        );
        ctx.closePath();
        ctx.fillStyle = fg;
        ctx.fill();
      }

      // Layer C: Front Core Flames (Intense White-Hot & Golden Yellow, heights 35-85px)
      const coreCount = 18;
      for (let i = 0; i < coreCount; i++) {
        const u = i / (coreCount - 1);
        const bx = 5 + u * (eng.W - 10);
        const phase = i * 4.19 + 2.7;
        const h =
          40 +
          (i % 3) * 16 +
          Math.sin(eng.time * 11.5 + phase) * 16 +
          Math.sin(eng.time * 24.3 + phase * 2) * 8;
        const sway = Math.sin(eng.time * 7.2 + phase) * 9;
        const tipX = bx + sway;
        const tipY = hearthY - h;
        const bw = 22 + (i % 2) * 8;

        const fg = ctx.createLinearGradient(bx, hearthY, tipX, tipY);
        fg.addColorStop(0, 'rgba(255, 255, 230, 0.98)');
        fg.addColorStop(0.4, 'rgba(255, 215, 60, 0.94)');
        fg.addColorStop(0.8, 'rgba(255, 135, 15, 0.75)');
        fg.addColorStop(1, 'rgba(255, 75, 0, 0)');

        ctx.beginPath();
        ctx.moveTo(bx - bw * 0.5, hearthY);
        ctx.quadraticCurveTo(bx - bw * 0.2 + sway * 0.3, hearthY - h * 0.45, tipX, tipY);
        ctx.quadraticCurveTo(
          bx + bw * 0.2 + sway * 0.3,
          hearthY - h * 0.45,
          bx + bw * 0.5,
          hearthY
        );
        ctx.closePath();
        ctx.fillStyle = fg;
        ctx.fill();
      }
    } else {
      // FRONT PASS (in front of / around the pizza):
      // 1. Warm underglow & rim light on the pizza crust
      if (eng.pizzaOffX > -eng.R * 2.5) {
        const px = eng.cx + eng.pizzaOffX;
        const py = eng.cy;
        const pr = eng.R;
        const pg = ctx.createRadialGradient(
          px,
          py + pr * 0.8,
          pr * 0.25,
          px,
          py + pr * 0.55,
          pr * 1.15
        );
        pg.addColorStop(0, `rgba(255, 150, 25, ${0.36 * fl * intensity})`);
        pg.addColorStop(0.55, `rgba(255, 75, 10, ${0.18 * fl * intensity})`);
        pg.addColorStop(1, 'rgba(200, 30, 0, 0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, pr * 1.05, 0, TAU);
        ctx.fill();
      }

      // 2. Foreground Lower Flame Licks along the bottom hearth lip (adds visual depth)
      const foreCount = 10;
      for (let i = 0; i < foreCount; i++) {
        const u = i / (foreCount - 1);
        const bx = eng.W * 0.05 + u * (eng.W * 0.9);
        const phase = i * 3.71;
        const h = 22 + (i % 3) * 12 + Math.sin(eng.time * 9.3 + phase) * 10;
        const sway = Math.sin(eng.time * 6.2 + phase) * 8;
        const tipX = bx + sway;
        const tipY = eng.H - h;
        const bw = 18 + (i % 2) * 6;

        const fg = ctx.createLinearGradient(bx, eng.H, tipX, tipY);
        fg.addColorStop(0, 'rgba(255, 230, 80, 0.85)');
        fg.addColorStop(0.5, 'rgba(255, 120, 20, 0.7)');
        fg.addColorStop(1, 'rgba(230, 40, 0, 0)');

        ctx.beginPath();
        ctx.moveTo(bx - bw * 0.5, eng.H);
        ctx.quadraticCurveTo(bx - bw * 0.2 + sway * 0.3, eng.H - h * 0.5, tipX, tipY);
        ctx.quadraticCurveTo(bx + bw * 0.2 + sway * 0.3, eng.H - h * 0.5, bx + bw * 0.5, eng.H);
        ctx.closePath();
        ctx.fillStyle = fg;
        ctx.fill();
      }

      // 3. Embers and Sparks (Floating up in front of everything)
      for (const e of eng.embers) {
        const yPct = clamp((e.y - 20) / (eng.H - 20), 0, 1);
        const rVal = 255;
        const gVal = (110 + yPct * 115) | 0;
        const bVal = (30 + yPct * 50) | 0;

        if (e.pType === 'flake' || e.r > 3) {
          // Large cinder with glowing radial halo
          const halo = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2.8);
          halo.addColorStop(0, `rgba(255, 235, 160, ${e.a * 0.9})`);
          halo.addColorStop(0.4, `rgba(255, 120, 20, ${e.a * 0.6})`);
          halo.addColorStop(1, 'rgba(200, 30, 0, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 2.8, 0, TAU);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${rVal},${gVal},${bVal},${e.a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, TAU);
        ctx.fill();
      }

      // 4. Subtle cozy warm hearth bloom vignette at the bottom corners
      const cornerG = ctx.createRadialGradient(
        eng.cx,
        eng.H,
        eng.W * 0.3,
        eng.cx,
        eng.H,
        eng.W * 0.8
      );
      cornerG.addColorStop(0, 'rgba(255, 100, 10, 0)');
      cornerG.addColorStop(1, `rgba(180, 40, 0, ${0.12 * fl})`);
      ctx.fillStyle = cornerG;
      ctx.fillRect(0, eng.H - 80, eng.W, 80);
    }
  };

  const drawPeel = (ctx: CanvasRenderingContext2D) => {
    const eng = engineRef.current;
    const px = eng.peel.x;
    const py = eng.cy + eng.R * 0.18;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    const handleW = px + 40 - eng.R * 0.7;
    if (handleW > 4) {
      ctx.fillStyle = '#B4864E';
      rrPath(ctx, -40, py - 7, handleW, 14, 7);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#C8995F';
    rrPath(ctx, px - eng.R * 0.95, py - eng.R * 0.34, eng.R * 1.9, eng.R * 0.5, 14);
    ctx.fill();
    ctx.stroke();
  };

  const drawPin = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const eng = engineRef.current;
    const w = Math.max(160, eng.R * 1.65);
    const h = Math.max(22, eng.R * 0.23);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(clamp(eng.pin.vx * 0.0016, -0.15, 0.15));
    ctx.fillStyle = 'rgba(58,38,20,.15)';
    rrPath(ctx, -w / 2 + 3, -h / 2 + 5, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#8A6B45';
    rrPath(ctx, -w / 2 - 14, -h * 0.28, 18, h * 0.56, 7);
    ctx.fill();
    ctx.stroke();
    rrPath(ctx, w / 2 - 4, -h * 0.28, 18, h * 0.56, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#CE9E63';
    rrPath(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  const drawLadle = (ctx: CanvasRenderingContext2D) => {
    const eng = engineRef.current;
    const tilt = clamp((eng.ptr.x - eng.ladle.x) * 0.02, -0.4, 0.4);
    ctx.save();
    ctx.translate(eng.ladle.x, eng.ladle.y);
    ctx.rotate(tilt);
    ctx.strokeStyle = '#7C5B36';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(eng.R * 0.1, -eng.R * 0.1);
    ctx.lineTo(eng.R * 0.42, -eng.R * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, eng.R * 0.16, 0, TAU);
    ctx.fillStyle = '#B9BFC7';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, eng.R * 0.11, 0, TAU);
    ctx.fillStyle = optionsRef.current.state.sauceId
      ? CATALOG.sauces[optionsRef.current.state.sauceId].color
      : '#B93A28';
    ctx.fill();
    ctx.restore();
  };

  const drawCarried = (ctx: CanvasRenderingContext2D) => {
    const eng = engineRef.current;
    if (!eng.carried) return;
    const inn = innerFrac();
    const over = Math.hypot(eng.carriedPos.x - eng.cx, eng.carriedPos.y - eng.cy) < eng.R * inn;
    if (over) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(51,36,26,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(eng.carriedPos.x, eng.carriedPos.y, TOPSIZE[eng.carried.type] * eng.R * 1.25, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawTopping(
      ctx,
      {
        type: eng.carried.type,
        rot: Math.sin(eng.time * 3) * 0.15,
        s: TOPSIZE[eng.carried.type] * 1.15,
        born: -1
      },
      eng.carriedPos.x,
      eng.carriedPos.y - 14,
      0
    );
  };

  const startToss = useCallback(() => {
    const eng = engineRef.current;
    eng.toss = { on: true, t: 0, landed: false };
    setIsTossing(true);
    SND.whoosh();
    flourBurst(eng.cx, eng.cy, 8);
    vib(20);
  }, []);

  const qualityOf = (d: number): OrderState['bakeQ'] => {
    return d < 0.55
      ? 'Underbaked'
      : d < 0.72
        ? 'Pale'
        : d <= 0.86
          ? 'Perfect'
          : d <= 1.02
            ? 'Well done'
            : 'Charred';
  };

  const pullOut = useCallback(() => {
    const eng = engineRef.current;
    if (!eng.baking || optionsRef.current.state.pulled) return;
    const d = eng.doneness;
    const win = d >= 0.72 && d <= 0.86;
    const q = qualityOf(d);
    optionsRef.current.onSetBakeQ(q);
    optionsRef.current.onSetPulled(true);
    optionsRef.current.onShowToast(
      win ? 'Perfect timing!' : d < 0.72 ? 'A little early…' : "It's burning!"
    );
    vib(win ? [20, 40, 20] : 40);
    steamBurst(12);
    SND.whoosh();
    eng.peel = { vis: true, phase: 'pullin', t: 0, x: -eng.R * 2.8 };
    eng.reviewReady = false;
    setReviewReady(false);
  }, []);

  const goBake = useCallback(() => {
    const eng = engineRef.current;
    eng.reviewReady = false;
    setReviewReady(false);
    optionsRef.current.onAdvanceStage('bake');
    eng.peel = { vis: true, phase: 'in', t: 0, x: -eng.R * 2.8 };
    eng.pizzaOffX = -eng.R * 2.8;
    eng.inOven = false;
    eng.baking = false;
    setIsBaking(false);
    startRumble();
    optionsRef.current.onShowToast('Into the fire it goes');
  }, []);

  const resetEngine = useCallback(() => {
    const eng = engineRef.current;
    eng.sauce.length = 0;
    eng.cheese.length = 0;
    eng.mirror.length = 0;
    eng.bubbles.length = 0;
    eng.toastSpots.length = 0;
    eng.spread = 0;
    eng.tossed = false;
    eng.sauceDone = false;
    eng.cheeseDone = false;
    eng.rollToasted = false;
    eng.drops.length = 0;
    eng.puffs.length = 0;
    eng.steams.length = 0;
    eng.embers.length = 0;
    eng.toss = { on: false, t: 0, landed: false };
    eng.peel = { vis: false, x: 0, phase: '', t: 0 };
    eng.inOven = false;
    eng.baking = false;
    eng.reviewReady = false;
    eng.doneness = 0;
    eng.pizzaOffX = 0;
    eng.carried = null;
    eng.baseKey = '';
    eng.cheeseMeltKey = -1;
    eng.boardW = -1;
    eng.boardH = -1;
    eng.sauceDirty = true;
    eng.cheeseDirty = true;
    sauceCellsRef.current.clear();
    cheeseCellsRef.current.clear();

    setSpread(0);
    setSauceCoverage(0);
    setCheeseCoverage(0);
    setSauceDone(false);
    setCheeseDone(false);
    setLiveDoneness(0);
    setIsBaking(false);
    setReviewReady(false);
    setIsTossing(false);
    stopRumble();
  }, []);

  const clearCheese = useCallback(() => {
    const eng = engineRef.current;
    eng.cheese.length = 0;
    eng.drops.length = 0;
    cheeseCellsRef.current.clear();
    eng.cheeseDirty = true;
    eng.cheeseDone = false;
    setCheeseCoverage(0);
    setCheeseDone(false);
    repaintCheese();
    SND.whoosh();
  }, []);

  const blanketCheese = useCallback(() => {
    const eng = engineRef.current;
    const units = optionsRef.current.state.cheeseUnits || 1;
    const cheeseType = optionsRef.current.state.cheeseId;
    const colors = CATALOG.cheeses[cheeseType]?.colors || CHEESE_C;

    // Reset current cheese and fill evenly across all radial zones
    eng.cheese.length = 0;
    cheeseCellsRef.current.clear();

    const targetBlobs = 300 + units * 220;
    for (let i = 0; i < targetBlobs; i++) {
      const a = Math.random() * TAU;
      const r = Math.sqrt(Math.random()) * 0.88;
      const lx = Math.cos(a) * r;
      const ly = Math.sin(a) * r;
      const blob = {
        x: lx,
        y: ly,
        r: 0.034 + Math.random() * 0.02,
        c: colors[(Math.random() * colors.length) | 0]
      };
      eng.cheese.push(blob);
      markCells(cheeseCellsRef.current, lx, ly, blob.r + 0.02);
    }

    repaintCheese();
    const cov = coverageOf(cheeseCellsRef.current);
    setCheeseCoverage(cov);
    eng.cheeseDone = true;
    setCheeseDone(true);
    SND.squelch(eng.time);
    vib(20);
    optionsRef.current.onShowToast(`Cheese evenly blanketed across the base! (${units}x layers)`);
  }, []);

  const addSceneTopping = useCallback(
    (id: ToppingId, zone: 'whole' | 'left' | 'right', x: number, y: number) => {
      const eng = engineRef.current;
      eng.mirror.push({
        type: id,
        x,
        y,
        zone,
        rot: Math.random() * TAU,
        s: TOPSIZE[id] * (0.9 + Math.random() * 0.25),
        born: eng.time
      });
    },
    []
  );

  const removeSceneTopping = useCallback((id: ToppingId) => {
    const eng = engineRef.current;
    for (let i = eng.mirror.length - 1; i >= 0; i--) {
      if (eng.mirror[i].type === id) {
        eng.mirror.splice(i, 1);
        break;
      }
    }
  }, []);

  const dropCarried = useCallback(() => {
    const eng = engineRef.current;
    if (!eng.carried) return;
    const id = eng.carried.type;
    const inn = innerFrac();

    if (Math.hypot(eng.carriedPos.x - eng.cx, eng.carriedPos.y - eng.cy) > eng.R * 1.15) {
      eng.carried = null;
      return;
    }

    const check = optionsRef.current.onCanPlace(id);
    if (!check.ok) {
      optionsRef.current.onShowToast(check.reason || 'Cannot place topping');
      SND.deny();
      eng.carried = null;
      return;
    }

    let lx = (eng.carriedPos.x - eng.cx) / (eng.R * inn);
    let ly = (eng.carriedPos.y - eng.cy) / (eng.R * inn);
    const z = optionsRef.current.state.zone;

    if (z === 'left' && lx > 0.06) {
      optionsRef.current.onShowToast('Drop it on the left half');
      SND.deny();
      eng.carried = null;
      return;
    }
    if (z === 'right' && lx < -0.06) {
      optionsRef.current.onShowToast('Drop it on the right half');
      SND.deny();
      eng.carried = null;
      return;
    }

    if (z === 'left') lx = Math.min(lx, -0.06);
    else if (z === 'right') lx = Math.max(lx, 0.06);

    const dist = Math.hypot(lx, ly);
    if (dist > 0.92) {
      lx = (lx / dist) * 0.92;
      ly = (ly / dist) * 0.92;
    }

    const charge = optionsRef.current.onCommitTopping(id, z, lx, ly);
    optionsRef.current.onSpawnChip(eng.carriedPos.x, eng.carriedPos.y, charge);
    SND.thud();
    vib(12);
    eng.carried = null;
  }, []);

  // Pointer event handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    getAudioContext();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const rect = canvas.getBoundingClientRect();
    const eng = engineRef.current;
    eng.ptr.down = true;
    eng.ptr.x = e.clientX - rect.left;
    eng.ptr.y = e.clientY - rect.top;

    if (optionsRef.current.state.stage === 'sauce') {
      trySauce(eng.ptr.x, eng.ptr.y, true);
    } else if (optionsRef.current.state.stage === 'cheese') {
      const units = optionsRef.current.state.cheeseUnits || 1;
      const maxCheese = 350 + units * 450;
      if (eng.cheese.length < maxCheese) {
        spawnCheese();
        spawnCheese();
        spawnCheese();
        if (units > 1) {
          spawnCheese();
          spawnCheese();
        }
      }
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const eng = engineRef.current;
    if (!eng.ptr.down) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;
    const dx = nx - eng.ptr.x;
    const dy = ny - eng.ptr.y;
    eng.ptr.x = nx;
    eng.ptr.y = ny;

    if (optionsRef.current.state.stage === 'base' && !eng.toss.on) {
      eng.pin.x = lerp(eng.pin.x, eng.ptr.x, 0.55);
      eng.pin.vx = lerp(eng.pin.vx, dx * 30, 0.3);
      const dist = Math.hypot(dx, dy);

      if (
        eng.spread < 1 &&
        dist > 1.5 &&
        Math.hypot(eng.ptr.x - eng.cx, eng.ptr.y - eng.cy) < eng.R * 1.4
      ) {
        const eff = Math.min(dist, 42);
        eng.spread = clamp(eng.spread + eff / (eng.R * 3.4), 0, 1);

        if (Math.random() < 0.3) {
          flourPuff(eng.ptr.x, eng.cy + eng.R * 0.2);
        }
        eng.rollAcc += eff;
        if (eng.rollAcc > 45) {
          eng.rollAcc = 0;
          SND.roll();
        }
        if (eng.spread >= 1 && !eng.rollToasted) {
          eng.rollToasted = true;
          optionsRef.current.onShowToast('Dough stretched — ready to toss');
          vib(20);
        }
      }
    }

    if (optionsRef.current.state.stage === 'sauce') {
      trySauce(eng.ptr.x, eng.ptr.y, false);
    } else if (optionsRef.current.state.stage === 'cheese') {
      const units = optionsRef.current.state.cheeseUnits || 1;
      const maxCheese = 350 + units * 450;
      if (eng.cheese.length < maxCheese) {
        spawnCheese();
        if (units > 2) spawnCheese();
      }
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    engineRef.current.ptr.down = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  }, []);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    engineRef.current.ptr.down = false;
    engineRef.current.carried = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  }, []);

  // Main animation frame loop - runs ONCE on mount!
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (!containerRef.current || !canvas || !offscreenRef.current) return;
      const eng = engineRef.current;
      const newDPR = Math.min(window.devicePixelRatio || 1, 2);
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      if (!newW || !newH) return;

      eng.DPR = newDPR;
      eng.W = newW;
      eng.H = newH;
      canvas.width = Math.round(newW * newDPR);
      canvas.height = Math.round(newH * newDPR);
      eng.cx = eng.W / 2;
      eng.cy = eng.H * 0.42;

      const {
        sauceC,
        cheeseC,
        boardC,
        baseC,
        ovenC,
        reviewC,
        sauceX,
        cheeseX,
        boardX,
        baseX,
        ovenX,
        reviewX
      } = offscreenRef.current;

      for (const c of [sauceC, cheeseC, boardC, baseC, ovenC, reviewC]) {
        c.width = canvas.width;
        c.height = canvas.height;
      }

      sauceX.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
      cheeseX.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
      boardX.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
      baseX.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
      ovenX.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
      reviewX.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);

      updateRadius();
      if (!eng.R) eng.R = eng.baseR;
      eng.boardW = -1;
      eng.boardH = -1;
      eng.baseKey = '';
      repaintSauce();
      repaintCheese();
    };

    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);
    resize();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const eng = engineRef.current;
      const currentStage = optionsRef.current.state.stage;

      // Physics update
      eng.time += dt;
      eng.shake = Math.max(0, eng.shake - dt * 2.4);
      eng.pin.vx *= 0.9;
      eng.R = lerp(eng.R, eng.baseR, Math.min(1, dt * 6));

      if (Math.abs(eng.W - eng.boardW) > 1 || Math.abs(eng.H - eng.boardH) > 1) {
        buildBoard();
        eng.boardW = eng.W;
        eng.boardH = eng.H;
      }

      // Particles
      for (let i = eng.puffs.length - 1; i >= 0; i--) {
        const p = eng.puffs[i];
        p.r += (p.vr || 0) * dt;
        p.y += p.vy * dt;
        p.a -= dt * 1.1;
        if (p.a <= 0) eng.puffs.splice(i, 1);
      }

      for (let i = eng.steams.length - 1; i >= 0; i--) {
        const s = eng.steams[i];
        s.y += s.vy * dt;
        s.x += (s.vx || 0) * dt + Math.sin((eng.time + i) * 2.5) * 6 * dt;
        s.r += (s.vr || 8) * dt;
        s.a -= dt * (s.sw || 0.55);
        if (s.a <= 0) eng.steams.splice(i, 1);
      }

      if (currentStage === 'bake') {
        const targetMaxEmbers = eng.doneness >= 0.72 ? 95 : 70;
        const spawnRate = eng.doneness >= 0.72 ? dt * 45 : dt * 28;
        if (Math.random() < spawnRate && eng.embers.length < targetMaxEmbers) {
          const roll = Math.random();
          if (roll < 0.45) {
            // Hot micro-spark
            eng.embers.push({
              x: Math.random() * eng.W,
              y: eng.H - 5 + Math.random() * 15,
              vx: (Math.random() - 0.5) * 45,
              vy: -90 - Math.random() * 95,
              sw: Math.random() * TAU,
              r: 0.9 + Math.random() * 1.2,
              a: 0.85 + Math.random() * 0.15,
              pType: 'spark',
              life: 0,
              maxLife: 1.2 + Math.random() * 0.9
            });
          } else if (roll < 0.82) {
            // Floating cinder
            eng.embers.push({
              x: Math.random() * eng.W,
              y: eng.H - 5 + Math.random() * 15,
              vx: (Math.random() - 0.5) * 18,
              vy: -38 - Math.random() * 45,
              sw: Math.random() * TAU,
              r: 1.8 + Math.random() * 1.8,
              a: 0.7 + Math.random() * 0.3,
              pType: 'cinder',
              life: 0,
              maxLife: 2.2 + Math.random() * 1.4
            });
          } else {
            // Glowing flake / coal fragment
            eng.embers.push({
              x: Math.random() * eng.W,
              y: eng.H - 5 + Math.random() * 15,
              vx: (Math.random() - 0.5) * 12,
              vy: -20 - Math.random() * 30,
              sw: Math.random() * TAU,
              r: 3.5 + Math.random() * 2.2,
              a: 0.65 + Math.random() * 0.25,
              pType: 'flake',
              life: 0,
              maxLife: 3.0 + Math.random() * 1.6
            });
          }
        }
        for (let i = eng.embers.length - 1; i >= 0; i--) {
          const e = eng.embers[i];
          e.life = (e.life || 0) + dt;
          const maxL = e.maxLife || 2.5;
          const lifeProgress = e.life / maxL;
          e.x += (e.vx || 0) * dt + Math.sin((e.sw || 0) + eng.time * 3.5) * 22 * dt;
          e.y += e.vy * dt;
          e.a = Math.max(0, (1 - lifeProgress) * (e.pType === 'spark' ? 0.95 : 0.8));
          if (e.y < -20 || e.life >= maxL || e.a <= 0) {
            eng.embers.splice(i, 1);
          }
        }
      }

      if (eng.toss.on) {
        eng.toss.t += dt;
        if (eng.toss.t >= 1.55) {
          eng.toss.on = false;
          eng.tossed = true;
          setIsTossing(false);
          optionsRef.current.onAdvanceStage('sauce');
          optionsRef.current.onShowToast('Pick a sauce, then paint it on');
        }
      }

      if (currentStage === 'sauce') {
        const tx = eng.ptr.down ? eng.ptr.x : eng.cx + eng.R * 1.4;
        const ty = eng.ptr.down ? eng.ptr.y : eng.cy - eng.R * 1.2;
        eng.ladle.x = lerp(eng.ladle.x, tx, Math.min(1, dt * 12));
        eng.ladle.y = lerp(eng.ladle.y, ty, Math.min(1, dt * 12));
      }

      if (currentStage === 'cheese' && eng.ptr.down) {
        const units = optionsRef.current.state.cheeseUnits || 1;
        const maxCheese = 350 + units * 450;
        if (eng.cheese.length < maxCheese) {
          eng.spawnAcc += dt;
          const per = Math.max(0.018, 0.038 - (units - 1) * 0.002);
          while (eng.spawnAcc > per) {
            eng.spawnAcc -= per;
            spawnCheese();
            spawnCheese();
            if (units > 1) {
              spawnCheese();
              spawnCheese();
            }
          }
        }
      }

      for (let i = eng.drops.length - 1; i >= 0; i--) {
        const d = eng.drops[i];
        d.vy += 900 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
        if (d.y >= d.ty) {
          if (eng.cheese.length < 10000) {
            // 10x capacity limit!
            const blob = { x: d.lx, y: d.ly, r: d.r, c: d.c };
            eng.cheese.push(blob);
            markCells(cheeseCellsRef.current, d.lx, d.ly, d.r + 0.02);
            blitCheese(blob);
            if (eng.landAcc++ % 6 === 0) SND.tick();
            const cov = coverageOf(cheeseCellsRef.current);
            const need = 0.58;
            if ((cov >= need || cov / need >= 0.98) && !eng.cheeseDone) {
              eng.cheeseDone = true;
              setCheeseDone(true);
              optionsRef.current.onShowToast('Cheese: blanketed! Keep sprinkling for extra melt');
              vib(15);
            }
          }
          eng.drops.splice(i, 1);
        } else if (d.y > eng.H + 20) {
          eng.drops.splice(i, 1);
        }
      }

      // Bake stage peel animation & oven dynamics
      if (currentStage === 'bake') {
        if (eng.peel.phase === 'in') {
          eng.peel.t += dt / 1.1;
          eng.peel.x = lerp(-eng.R * 2.8, eng.cx, easeOutCubic(clamp(eng.peel.t, 0, 1)));
          eng.pizzaOffX = eng.peel.x - eng.cx;
          if (eng.peel.t >= 1) {
            eng.inOven = true;
            eng.baking = true;
            setIsBaking(true);
            eng.peel.phase = 'pause';
            eng.peel.t = 0;
            eng.pizzaOffX = 0;
          }
        } else if (eng.peel.phase === 'pause') {
          eng.peel.t += dt;
          if (eng.peel.t > 0.22) {
            eng.peel.phase = 'retreat';
            eng.peel.t = 0;
          }
        } else if (eng.peel.phase === 'retreat') {
          eng.peel.t += dt / 0.9;
          eng.peel.x = lerp(eng.cx, -eng.R * 2.8, easeInQuad(clamp(eng.peel.t, 0, 1)));
          if (eng.peel.t >= 1) eng.peel.vis = false;
        } else if (eng.peel.phase === 'pullin') {
          eng.peel.t += dt / 0.8;
          eng.peel.x = lerp(-eng.R * 2.8, eng.cx, easeOutCubic(clamp(eng.peel.t, 0, 1)));
          eng.peel.vis = true;
          if (eng.peel.t >= 1) {
            eng.peel.phase = 'exit';
            eng.peel.t = 0;
          }
        } else if (eng.peel.phase === 'exit') {
          eng.peel.t += dt / 0.8;
          const p = easeInQuad(clamp(eng.peel.t, 0, 1));
          eng.peel.x = lerp(eng.cx, -eng.R * 3, p);
          eng.pizzaOffX = eng.peel.x - eng.cx;
          if (eng.peel.t >= 1) {
            eng.peel.vis = false;
            stopRumble();
            eng.reviewReady = true;
            setReviewReady(true);
          }
        }

        if (currentStage === 'bake' && Math.random() < dt * (eng.doneness >= 0.72 ? 12 : 7)) {
          SND.crackle();
        }

        if (eng.baking && !optionsRef.current.state.pulled) {
          eng.doneness += dt / 13;
          const d = eng.doneness;

          if (d > 0.4 && d < 0.98 && Math.random() < dt * 2.2 && eng.cheese.length) {
            const o = eng.cheese[(Math.random() * eng.cheese.length) | 0];
            if (eng.bubbles.length < 24) {
              eng.bubbles.push({ x: o.x, y: o.y, r: 0.018 + Math.random() * 0.02, t: 0 });
            }
          }

          if (d > 0.45 && Math.random() < dt * 4 && eng.steams.length < 36) {
            eng.steams.push({
              x: eng.cx + (Math.random() - 0.5) * eng.R,
              y: eng.cy - eng.R * 0.5 * Math.random(),
              vy: -30 - Math.random() * 30,
              r: 4 + Math.random() * 6,
              a: 0.5
            });
          }

          if (d >= 1.06) pullOut();
        }
      }

      // ── Review stage: full lush steam/smoke ──
      if (currentStage === 'review') {
        // Layer 1: Rising plumes from pizza surface (frequent, medium)
        if (Math.random() < dt * 4.5 && eng.steams.length < 60) {
          const angle = Math.random() * TAU;
          const dist = Math.random() * 0.7;
          eng.steams.push({
            x: eng.cx + Math.cos(angle) * dist * eng.R,
            y: eng.cy + Math.sin(angle) * dist * eng.R * 0.5,
            vx: (Math.random() - 0.5) * 8,
            vy: -22 - Math.random() * 30,
            vr: 6 + Math.random() * 8,
            r: 3 + Math.random() * 6,
            a: 0.35 + Math.random() * 0.2,
            sw: 0.22 + Math.random() * 0.15
          });
        }

        // Layer 2: Side wisps from pizza edges (lateral drift)
        if (Math.random() < dt * 2.2 && eng.steams.length < 70) {
          const side = Math.random() < 0.5 ? -1 : 1;
          eng.steams.push({
            x: eng.cx + side * eng.R * (0.7 + Math.random() * 0.35),
            y: eng.cy - eng.R * 0.1 + (Math.random() - 0.5) * eng.R * 0.4,
            vx: side * (10 + Math.random() * 15),
            vy: -12 - Math.random() * 18,
            vr: 10 + Math.random() * 6,
            r: 4 + Math.random() * 5,
            a: 0.25 + Math.random() * 0.15,
            sw: 0.18 + Math.random() * 0.1
          });
        }

        // Layer 3: Big slow background clouds (rare, large, very slow fade)
        if (Math.random() < dt * 0.8 && eng.steams.length < 75) {
          eng.steams.push({
            x: eng.cx + (Math.random() - 0.5) * eng.R * 0.6,
            y: eng.cy - eng.R * 0.2,
            vx: (Math.random() - 0.5) * 5,
            vy: -8 - Math.random() * 10,
            vr: 14 + Math.random() * 8,
            r: 8 + Math.random() * 10,
            a: 0.15 + Math.random() * 0.1,
            sw: 0.08 + Math.random() * 0.06
          });
        }
      }

      for (let i = eng.bubbles.length - 1; i >= 0; i--) {
        const b = eng.bubbles[i];
        b.t += dt;
        if (b.t > 1.4) {
          if (eng.toastSpots.length < 70) {
            eng.toastSpots.push({ x: b.x, y: b.y, r: b.r * 0.75 });
          }
          eng.bubbles.splice(i, 1);
        }
      }

      if (eng.sauceDirty) repaintSauce();
      if (eng.cheeseDirty) repaintCheese();

      // Throttled UI status updates at 10Hz
      eng.meterAcc += dt;
      if (eng.meterAcc > 0.1) {
        eng.meterAcc = 0;
        setSpread(eng.spread);
        setSauceCoverage(coverageOf(sauceCellsRef.current));
        setCheeseCoverage(coverageOf(cheeseCellsRef.current));
        setLiveDoneness(eng.doneness);
      }

      // Render canvas
      if (eng.W) {
        ctx.setTransform(eng.DPR, 0, 0, eng.DPR, 0, 0);
        ctx.clearRect(0, 0, eng.W, eng.H);
        ctx.save();
        if (eng.shake > 0) {
          ctx.translate(
            (Math.random() - 0.5) * eng.shake * 9,
            (Math.random() - 0.5) * eng.shake * 9
          );
        }

        if (currentStage === 'bake') {
          // Oven frame & rear fire / glowing hearth
          if (offscreenRef.current) {
            ctx.drawImage(offscreenRef.current.ovenC, 0, 0, eng.W, eng.H);
            drawWoodFiredFireplace(ctx, true);
          }

          if (eng.peel.vis) drawPeel(ctx);

          ctx.save();
          ctx.translate(
            0,
            eng.baking && !optionsRef.current.state.pulled ? Math.sin(eng.time * 9) * 0.8 : 0
          );
          drawPizzaFull(ctx, eng.cx + eng.pizzaOffX, eng.cy);
          ctx.restore();

          // Foreground fire licks, pizza rim-light underglow, and floating embers/sparks
          drawWoodFiredFireplace(ctx, false);
        } else {
          if (offscreenRef.current) {
            ctx.drawImage(offscreenRef.current.boardC, 0, 0, eng.W, eng.H);
          }
          if (currentStage === 'base' || currentStage === 'start') {
            drawDoughStage(ctx);
          } else if (currentStage === 'review') {
            drawPizzaShadow(ctx, eng.cx, eng.cy);
            drawReviewSeparatedSlices(ctx, eng.cx, eng.cy);
          } else {
            drawPizzaShadow(ctx, eng.cx, eng.cy);
            drawPizzaFull(ctx, eng.cx, eng.cy);
            if (currentStage === 'top') drawZoneOverlay(ctx);
          }
        }

        // Steams — soft gradient smoke
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const s of eng.steams) {
          const alpha = Math.max(0, s.a * 0.3);
          if (alpha < 0.005) continue;
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
          grad.addColorStop(0, `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`);
          grad.addColorStop(0.4, `rgba(245,240,230,${(alpha * 0.5).toFixed(3)})`);
          grad.addColorStop(1, `rgba(255,255,255,0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, TAU);
          ctx.fill();
        }
        ctx.restore();

        // Puffs
        for (const p of eng.puffs) {
          ctx.fillStyle = `rgba(255,252,240,${Math.max(0, p.a).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, TAU);
          ctx.fill();
        }

        if (currentStage === 'base' && !eng.toss.on && eng.ptr.down) {
          drawPin(ctx, eng.pin.x, eng.cy - 2);
        }
        if (currentStage === 'sauce') {
          drawLadle(ctx);
        }
        if (currentStage === 'cheese') {
          for (const d of eng.drops) {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rot);
            ctx.fillStyle = d.c;
            const r = d.r * eng.R;
            ctx.beginPath();
            ctx.moveTo(-r, -r * 0.7);
            ctx.lineTo(r * 1.1, 0);
            ctx.lineTo(-r * 0.6, r);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          if (eng.ptr.down) {
            ctx.fillStyle = '#F3CB77';
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              ctx.arc(
                eng.ptr.x + (i - 1) * 7,
                eng.ptr.y - 22 + Math.sin(eng.time * 10 + i) * 2,
                4.5 - i,
                0,
                TAU
              );
              ctx.fill();
              ctx.stroke();
            }
          }
        }
        if (eng.carried) drawCarried(ctx);
        ctx.restore();
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []); // Run ONCE on mount!

  return {
    canvasRef,
    containerRef,
    spread,
    sauceCoverage,
    cheeseCoverage,
    sauceDone,
    cheeseDone,
    liveDoneness,
    isBaking,
    reviewReady,
    isTossing,
    startToss,
    pullOut,
    goBake,
    resetEngine,
    blanketCheese,
    clearCheese,
    addSceneTopping,
    removeSceneTopping,
    dropCarried,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    engineRef
  };
}
