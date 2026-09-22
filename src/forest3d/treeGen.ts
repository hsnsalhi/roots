import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './noise';

export type Quality = 'low' | 'high';

export interface TreeVariant {
  trunk: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
  /** horizontal radius of the canopy (unit tree) */
  canopyRadius: number;
  /** height of the highest leaf (unit tree) */
  top: number;
  shrub: boolean;
}

interface Params {
  trunkLen: number;
  trunkRadius: number;
  levels: number;
  branches: number[];
  spread: number;     // angle (rad) of children from their parent
  lenRatio: number;
  wiggle: number;     // random bending per piece
  up: number;         // phototropism (children bend upwards)
  split: number;      // where along the trunk the first branches start (0..1)
  leafSize: number;
  leafPer: number;    // quads per leaf cluster (high quality)
}

export type Kind = 'oak' | 'ash' | 'poplar' | 'round';
export const KINDS: Kind[] = ['oak', 'ash', 'poplar', 'round'];

const PARAMS: Record<Kind, (r: () => number) => Params> = {
  oak: (r) => ({ trunkLen: 4.2 + r(), trunkRadius: 0.44, levels: 3, branches: [4, 3, 3], spread: 0.85, lenRatio: 0.62, wiggle: 0.35, up: 0.06, split: 0.5, leafSize: 1.75, leafPer: 3 }),
  ash: (r) => ({ trunkLen: 5.5 + r(), trunkRadius: 0.36, levels: 3, branches: [3, 3, 3], spread: 0.62, lenRatio: 0.6, wiggle: 0.25, up: 0.1, split: 0.5, leafSize: 1.6, leafPer: 3 }),
  poplar: (r) => ({ trunkLen: 6.5 + r(), trunkRadius: 0.32, levels: 3, branches: [5, 2, 2], spread: 0.45, lenRatio: 0.5, wiggle: 0.15, up: 0.18, split: 0.25, leafSize: 1.35, leafPer: 2 }),
  round: (r) => ({ trunkLen: 3.6 + r(), trunkRadius: 0.42, levels: 3, branches: [5, 3, 2], spread: 0.95, lenRatio: 0.58, wiggle: 0.3, up: 0.03, split: 0.65, leafSize: 1.85, leafPer: 3 }),
};

interface Seg {
  a: THREE.Vector3;
  b: THREE.Vector3;
  r0: number;
  r1: number;
  radial: number;
}

interface LeafPt {
  p: THREE.Vector3;
  s: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/** a unit vector at angle `elev` from `d`, rotated `az` around it */
function rotateAway(d: THREE.Vector3, az: number, elev: number): THREE.Vector3 {
  const ref = Math.abs(d.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(d, ref).normalize();
  const v = new THREE.Vector3().crossVectors(d, u).normalize();
  return new THREE.Vector3()
    .addScaledVector(d, Math.cos(elev))
    .addScaledVector(u, Math.sin(elev) * Math.cos(az))
    .addScaledVector(v, Math.sin(elev) * Math.sin(az))
    .normalize();
}

function pointAt(pts: THREE.Vector3[], t: number): THREE.Vector3 {
  const f = t * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  return new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], f - i);
}

function segGeometry(s: Seg): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(s.b, s.a);
  const len = dir.length();
  dir.normalize();
  const g = new THREE.CylinderGeometry(s.r1, s.r0, len, s.radial, 1, true);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len * 0.45);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
  g.translate((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2, (s.a.z + s.b.z) / 2);
  return g;
}

function leafQuad(p: THREE.Vector3, s: number, r: () => number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(s, s * 0.9);
  g.rotateX((r() - 0.5) * Math.PI * 0.9);
  g.rotateY(r() * Math.PI * 2);
  g.rotateZ((r() - 0.5) * 1.2);
  g.translate(p.x + (r() - 0.5) * s * 0.7, p.y + (r() - 0.5) * s * 0.5, p.z + (r() - 0.5) * s * 0.7);
  return g;
}

function grow(params: Params, r: () => number, segs: Seg[], leaves: LeafPt[], start: THREE.Vector3, dir: THREE.Vector3, len: number, radius: number, level: number) {
  const pieces = level === 0 ? 5 : 3;
  let p = start.clone();
  const d = dir.clone();
  const rEnd = radius * (level === 0 ? 0.6 : 0.5);
  const pts = [p.clone()];
  for (let i = 0; i < pieces; i++) {
    d.x += (r() - 0.5) * params.wiggle;
    d.z += (r() - 0.5) * params.wiggle;
    d.y += level > 0 ? params.up : (r() - 0.5) * 0.05;
    d.normalize();
    const q = p.clone().addScaledVector(d, len / pieces);
    segs.push({
      a: p, b: q,
      r0: radius + (rEnd - radius) * (i / pieces),
      r1: radius + (rEnd - radius) * ((i + 1) / pieces),
      radial: level === 0 ? 8 : level === 1 ? 6 : 5,
    });
    p = q;
    pts.push(p.clone());
  }
  if (level < params.levels) {
    const n = params.branches[level] + Math.floor(r() * 2);
    const az0 = r() * Math.PI * 2;
    for (let j = 0; j < n; j++) {
      const t = level === 0 ? params.split + r() * (1 - params.split) : 0.3 + r() * 0.7;
      const pos = pointAt(pts, t);
      const az = az0 + (j * Math.PI * 2) / n + (r() - 0.5) * 0.7;
      const elev = params.spread * (0.7 + r() * 0.6);
      const cd = rotateAway(d, az, elev);
      const cl = len * params.lenRatio * (0.75 + r() * 0.5);
      grow(params, r, segs, leaves, pos, cd, cl, rEnd * (level === 0 ? 0.9 : 0.8), level + 1);
    }
  }
  if (level >= params.levels - 1) {
    const count = level === params.levels ? 3 : 1;
    for (let k = 0; k < count; k++) {
      leaves.push({ p: pointAt(pts, level === params.levels ? 0.45 + (k / count) * 0.55 : 0.85 + r() * 0.15), s: params.leafSize * (0.8 + r() * 0.4) });
    }
  }
}

function assemble(segs: Seg[], leaves: LeafPt[], quality: Quality, r: () => number, shrub: boolean): TreeVariant {
  const trunkParts = segs.map(segGeometry);
  const trunk = mergeGeometries(trunkParts, false)!;
  trunkParts.forEach((g) => g.dispose());
  const per = quality === 'high' ? 1.5 : 0.9;
  const leafParts: THREE.BufferGeometry[] = [];
  for (const l of leaves) {
    const n = Math.max(1, Math.round(3 * per));
    for (let i = 0; i < n; i++) leafParts.push(leafQuad(l.p, l.s, r));
  }
  const leavesGeom = mergeGeometries(leafParts, false)!;
  leafParts.forEach((g) => g.dispose());
  leavesGeom.computeBoundingBox();
  const bb = leavesGeom.boundingBox!;
  // foliage normals point away from the canopy centre (with an upward bias):
  // lighting then reads as one rounded volume instead of a jumble of quads.
  const pos = leavesGeom.attributes.position as THREE.BufferAttribute;
  const nrm = leavesGeom.attributes.normal as THREE.BufferAttribute;
  const cy = (bb.min.y + bb.max.y) / 2;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), (pos.getY(i) - cy) * 0.9 + (bb.max.y - cy) * 0.45, pos.getZ(i)).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  trunk.computeBoundingSphere();
  leavesGeom.computeBoundingSphere();
  return {
    trunk,
    leaves: leavesGeom,
    canopyRadius: Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x), Math.abs(bb.min.z), Math.abs(bb.max.z)),
    top: bb.max.y,
    shrub,
  };
}

export function buildTree(kind: Kind, seed: number, quality: Quality): TreeVariant {
  const r = rng(seed);
  const params = PARAMS[kind](r);
  const segs: Seg[] = [];
  const leaves: LeafPt[] = [];
  const lean = new THREE.Vector3((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12).normalize();
  grow(params, r, segs, leaves, new THREE.Vector3(0, -0.3, 0), lean, params.trunkLen, params.trunkRadius, 0);
  return assemble(segs, leaves, quality, r, false);
}

export function buildShrub(seed: number, quality: Quality): TreeVariant {
  const r = rng(seed);
  const segs: Seg[] = [];
  const leaves: LeafPt[] = [];
  segs.push({ a: new THREE.Vector3(0, -0.2, 0), b: new THREE.Vector3(0, 0.5, 0), r0: 0.16, r1: 0.11, radial: 6 });
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const d = rotateAway(UP, (i / n) * Math.PI * 2 + r() * 0.5, 0.8 + r() * 0.45);
    const a = new THREE.Vector3(0, 0.4, 0);
    const b = a.clone().addScaledVector(d, 1.3 + r() * 0.8);
    segs.push({ a, b, r0: 0.09, r1: 0.05, radial: 5 });
    leaves.push({ p: b, s: 1.15 + r() * 0.4 });
    leaves.push({ p: new THREE.Vector3().lerpVectors(a, b, 0.6), s: 1.0 + r() * 0.3 });
  }
  return assemble(segs, leaves, quality, r, true);
}

export interface VariantSet {
  trees: TreeVariant[];
  shrubs: TreeVariant[];
}

export function buildVariantSet(quality: Quality): VariantSet {
  const trees: TreeVariant[] = [];
  const perKind = quality === 'high' ? 3 : 2;
  KINDS.forEach((kind, ki) => {
    for (let i = 0; i < perKind; i++) trees.push(buildTree(kind, 1000 + ki * 17 + i * 101, quality));
  });
  const shrubs = [buildShrub(7, quality), buildShrub(8, quality)];
  return { trees, shrubs };
}

export function disposeVariants(set: VariantSet) {
  for (const v of [...set.trees, ...set.shrubs]) {
    v.trunk.dispose();
    v.leaves.dispose();
  }
}
