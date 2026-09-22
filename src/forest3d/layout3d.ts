import { ALPHABET, seeded } from '../roots';
import type { BiRoot } from '../types';
import { terrainHeight } from './terrain';

export interface Tree3D {
  bi: BiRoot;
  x: number;
  y: number;        // ground height
  z: number;
  height: number;   // world height of the tree
  variant: number;  // index into the variant list (trees or shrubs)
  shrub: boolean;
  rotation: number;
  sx: number;       // horizontal scale variation
  sz: number;
  grove: string;
}

export interface Grove3D {
  letter: string;
  cx: number;
  cz: number;
  radius: number;
  signX: number;
  signZ: number;
  trees: Tree3D[];
}

export interface Layout3D {
  groves: Grove3D[];
  trees: Tree3D[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function layout3D(bis: BiRoot[], variants: number, shrubVariants: number): Layout3D {
  const maxTokens = Math.max(1, ...bis.map((b) => b.verbTokens));
  const byLetter = new Map<string, BiRoot[]>();
  for (const b of bis) {
    const l = b.id[0];
    if (!byLetter.has(l)) byLetter.set(l, []);
    byLetter.get(l)!.push(b);
  }
  const letters = ALPHABET.filter((l) => byLetter.has(l));

  // build groves (local coordinates first)
  const groves = letters.map((letter) => {
    const items = [...byLetter.get(letter)!];
    const rand = seeded('g3d' + letter);
    const trees = items.map((bi) => {
      const shrub = bi.verbTokens === 0;
      const ratio = Math.log(1 + bi.verbTokens) / Math.log(1 + maxTokens);
      const height = shrub ? 2.3 + rand() * 0.7 : 7 + 16 * Math.pow(ratio, 0.85);
      return {
        bi, height, shrub,
        variant: Math.floor(rand() * (shrub ? shrubVariants : variants)),
        rotation: rand() * Math.PI * 2,
        sx: 0.9 + rand() * 0.25,
        sz: 0.9 + rand() * 0.25,
        canopy: shrub ? 1.6 : height * 0.34,
      };
    });
    trees.sort((a, b) => b.height - a.height); // biggest in the middle
    const meanCanopy = trees.reduce((s, t) => s + t.canopy, 0) / trees.length;
    const c = Math.max(4.5, meanCanopy * 1.9);
    const placed = trees.map((t, k) => {
      const rr = c * Math.sqrt(k + 0.4) * (0.92 + rand() * 0.16);
      const a = k * GOLDEN + rand() * 0.3;
      return { ...t, lx: Math.cos(a) * rr, lz: Math.sin(a) * rr };
    });
    const radius = c * Math.sqrt(trees.length + 0.4) + meanCanopy;
    return { letter, placed, radius };
  });

  // arrange groves in serpentine rows: right to left (alphabetical), then the next row further back
  const rowsWanted = Math.max(1, Math.round(Math.sqrt(groves.length / 1.7)));
  const totalW = groves.reduce((s, g) => s + g.radius * 2 + 16, 0);
  const rowW = totalW / rowsWanted;
  const rows: typeof groves[] = [[]];
  let acc = 0;
  for (const g of groves) {
    const w = g.radius * 2 + 16;
    if (rows[rows.length - 1].length && acc + w > rowW * 1.08 && rows.length < rowsWanted) {
      rows.push([g]);
      acc = w;
    } else {
      rows[rows.length - 1].push(g);
      acc += w;
    }
  }
  const rowGap = 26;
  const out: Grove3D[] = [];
  const all: Tree3D[] = [];
  let z = 0;
  const rowDepths = rows.map((row) => Math.max(...row.map((g) => g.radius)) * 2 + rowGap);
  const totalDepth = rowDepths.reduce((s, d) => s + d, 0);
  z = totalDepth / 2; // first row nearest the viewer (positive z)
  rows.forEach((row, ri) => {
    const width = row.reduce((s, g) => s + g.radius * 2 + 16, 0) - 16;
    let x = width / 2;                       // start at the right (RTL: alphabetical order runs right to left)
    const zc = z - rowDepths[ri] / 2;
    for (const g of row) {
      const cx = x - g.radius;
      const cz = zc + Math.sin(cx / 110) * 22;
      const trees: Tree3D[] = g.placed.map((t) => {
        const wx = cx + t.lx;
        const wz = cz + t.lz;
        return { bi: t.bi, x: wx, z: wz, y: terrainHeight(wx, wz), height: t.height, variant: t.variant, shrub: t.shrub, rotation: t.rotation, sx: t.sx, sz: t.sz, grove: g.letter };
      });
      const signX = cx + g.radius * 0.35;
      const signZ = cz + g.radius + 4;
      out.push({ letter: g.letter, cx, cz, radius: g.radius, signX, signZ, trees });
      all.push(...trees);
      x -= g.radius * 2 + 16;
    }
    z -= rowDepths[ri];
  });
  const xs = out.flatMap((g) => [g.cx - g.radius, g.cx + g.radius]);
  const zs = out.flatMap((g) => [g.cz - g.radius, g.cz + g.radius]);
  return {
    groves: out,
    trees: all,
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) },
  };
}
