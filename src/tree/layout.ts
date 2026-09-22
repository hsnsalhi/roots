import type { IndexRoot, RootFile, Verb } from '../types';
import { compareRoots } from '../roots';

export interface VerbNode {
  key: string;
  root: RootFile;
  verb: Verb;
  angle: number;   // radians, 0 = straight up, positive = right (x > 0)
  x: number;
  y: number;
  lx: number;      // label position
  ly: number;
}

export interface RootNode {
  root: RootFile;
  idx: IndexRoot;
  angle: number;
  x: number;
  y: number;
  verbs: VerbNode[];
  tokens: number;
}

export interface TreeLayout {
  T: number;       // trunk height
  R1: number;
  R2: number;
  roots: RootNode[];
  maxTokens: number;
  maxVerb: number;
  bbox: { x: number; y: number; width: number; height: number };
}

const DEG = Math.PI / 180;

export function layoutTree(files: RootFile[], idx: Map<string, IndexRoot>): TreeLayout {
  const sorted = [...files].sort((a, b) => compareRoots(a.letters.join(''), b.letters.join('')));
  const slots = sorted.map((f) => Math.max(1, f.verbs.length));
  const total = slots.reduce((s, n) => s + n, 0);
  const slot = Math.min(22 * DEG, (150 * DEG) / total);
  const span = slot * total;
  const spanRad = Math.max(span, 0.6);
  const T = 130;
  const n = sorted.length;
  const R1 = Math.min(440, Math.max(190, Math.max(170 + 10 * n, (58 * n) / spanRad)));
  const R2 = Math.max(R1 + 150, (32 * total) / spanRad);

  let a = -span / 2;
  const maxTokens = Math.max(1, ...sorted.map((f) => f.verbs.reduce((s, v) => s + v.count, 0)));
  const maxVerb = Math.max(1, ...sorted.flatMap((f) => f.verbs.map((v) => v.count)));
  const roots: RootNode[] = sorted.map((f) => {
    const verbs: VerbNode[] = [];
    const k = Math.max(1, f.verbs.length);
    const start = a;
    const verbsSorted = [...f.verbs].sort((x, y) => x.form - y.form || y.count - x.count);
    verbsSorted.forEach((v, i) => {
      const ang = start + (i + 0.5) * slot;
      verbs.push({
        key: f.r + '|' + v.lem,
        root: f,
        verb: v,
        angle: ang,
        x: R2 * Math.sin(ang),
        y: -T - R2 * Math.cos(ang),
        lx: (R2 + 30) * Math.sin(ang),
        ly: -T - (R2 + 30) * Math.cos(ang),
      });
    });
    const angle = start + (k * slot) / 2;
    a += k * slot;
    const r = f.verbs.length ? R1 : R1 * 0.78;
    return {
      root: f,
      idx: idx.get(f.r)!,
      angle,
      x: r * Math.sin(angle),
      y: -T - r * Math.cos(angle),
      verbs,
      tokens: f.verbs.reduce((s, v) => s + v.count, 0),
    };
  });
  const xs = roots.flatMap((r) => [r.x, ...r.verbs.map((v) => v.lx)]);
  const ys = roots.flatMap((r) => [r.y, ...r.verbs.map((v) => v.ly)]);
  const minX = Math.min(-120, ...xs) - 90;
  const maxX = Math.max(120, ...xs) + 90;
  const minY = Math.min(-T - 60, ...ys) - 60;
  return { T, R1, R2, roots, maxTokens, maxVerb, bbox: { x: minX, y: minY, width: maxX - minX, height: 70 - minY } };
}
