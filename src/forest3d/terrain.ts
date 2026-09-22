import * as THREE from 'three';
import { fbm } from './noise';

export const TERRAIN_SIZE = 1500;

/** ground height at a world position (gentle rolling hills, flattening towards the edge) */
export function terrainHeight(x: number, z: number): number {
  const h = fbm(x / 300, z / 300, 4, 7) * 11 + fbm(x / 70, z / 70, 3, 9) * 1.4;
  const d = Math.max(Math.abs(x), Math.abs(z));
  const edge = TERRAIN_SIZE / 2;
  const f = d > edge - 160 ? Math.max(0, (edge - d) / 160) : 1;
  return h * f * f * (3 - 2 * f);
}

function detailTexture(): THREE.CanvasTexture {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(s, s);
  // seamless: blend four offset copies of the noise with linear weights
  const sample = (x: number, y: number) => fbm(x / 64, y / 64, 4, 31) * 0.6 + fbm(x / 22, y / 22, 2, 33) * 0.4;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const wx = x / s;
      const wy = y / s;
      const n =
        sample(x, y) * (1 - wx) * (1 - wy) +
        sample(x - s, y) * wx * (1 - wy) +
        sample(x, y - s) * (1 - wx) * wy +
        sample(x - s, y - s) * wx * wy;
      const v = 214 + n * 26;
      const i = (y * s + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v + 3;
      img.data[i + 2] = v - 8;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 26);
  t.anisotropy = 8;
  return t;
}

export function buildTerrain(): THREE.Mesh {
  const segs = 220;
  const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color('#4f7a34');
  const grassB = new THREE.Color('#7ea34a');
  const grassC = new THREE.Color('#6d8f3b');
  const dirt = new THREE.Color('#8b6b45');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const n = fbm(x / 120 + 3, z / 120, 3, 41) * 0.5 + 0.5;
    const m = fbm(x / 40, z / 40 + 9, 2, 43) * 0.5 + 0.5;
    tmp.copy(grassA).lerp(grassB, n).lerp(grassC, m * 0.5);
    const dry = Math.max(0, fbm(x / 90 + 50, z / 90, 3, 47) - 0.35) * 1.6;
    tmp.lerp(dirt, Math.min(0.6, dry));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(), roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  // an endless flat meadow beyond the detailed terrain, so no edge is ever visible
  const far = new THREE.Mesh(
    new THREE.CircleGeometry(9000, 48),
    new THREE.MeshStandardMaterial({ color: '#5f8a3d', map: mat.map, roughness: 1 }),
  );
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.05;
  far.receiveShadow = true;
  far.name = 'terrain-far';
  mesh.add(far);
  return mesh;
}
