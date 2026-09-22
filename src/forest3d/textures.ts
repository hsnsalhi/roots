import * as THREE from 'three';
import { fbm, rng } from './noise';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, srgb = true, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Procedural bark: vertical fibres, cracks and lichen. */
export function barkTexture(seed = 1): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const [c, ctx] = canvas(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const ny = y / h;
      // stretched noise gives vertical fibres; wrap horizontally
      const fib = fbm(Math.cos(nx * Math.PI * 2) * 3 + seed, ny * 18, 4, 3) * 0.5 + fbm(Math.sin(nx * Math.PI * 2) * 3, ny * 18 + 7, 3, 5) * 0.5;
      const crack = Math.pow(Math.abs(fbm(Math.cos(nx * Math.PI * 2) * 2.2, ny * 6, 3, 11)), 0.6);
      let l = 0.42 + fib * 0.18 - crack * 0.22;
      const lichen = Math.max(0, fbm(nx * 9, ny * 9, 2, 21) - 0.45) * 0.8;
      l = Math.min(1, Math.max(0, l));
      const r = 92 * l + 40 * lichen * 0.3;
      const g = 66 * l + 70 * lichen;
      const b = 46 * l + 30 * lichen * 0.2;
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = tex(c, true, true);
  t.repeat.set(1, 2);
  return t;
}

/** A clump of leaves on a transparent background (alpha‑tested quads). */
export function leafTexture(seed = 2, hue = 100): THREE.CanvasTexture {
  const s = 256;
  const [c, ctx] = canvas(s, s);
  const r = rng(seed);
  ctx.clearRect(0, 0, s, s);
  const leaves = 26;
  for (let i = 0; i < leaves; i++) {
    const cx = 32 + r() * (s - 64);
    const cy = 32 + r() * (s - 64);
    const len = 34 + r() * 30;
    const wid = len * (0.42 + r() * 0.2);
    const ang = r() * Math.PI * 2;
    const light = 30 + r() * 22;
    const sat = 45 + r() * 25;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const grad = ctx.createLinearGradient(0, -len / 2, 0, len / 2);
    grad.addColorStop(0, `hsl(${hue + r() * 14 - 7} ${sat}% ${light + 8}%)`);
    grad.addColorStop(1, `hsl(${hue + r() * 14 - 7} ${sat}% ${light - 6}%)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -len / 2);
    ctx.bezierCurveTo(wid / 2, -len / 4, wid / 2, len / 4, 0, len / 2);
    ctx.bezierCurveTo(-wid / 2, len / 4, -wid / 2, -len / 4, 0, -len / 2);
    ctx.fill();
    ctx.strokeStyle = `hsl(${hue} ${sat}% ${light - 14}% / 0.6)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -len / 2 + 4);
    ctx.lineTo(0, len / 2 - 4);
    ctx.stroke();
    ctx.restore();
  }
  return tex(c, true, false);
}

/** Grass tuft on a transparent background. */
export function grassTexture(seed = 3): THREE.CanvasTexture {
  const s = 128;
  const [c, ctx] = canvas(s, s);
  const r = rng(seed);
  ctx.clearRect(0, 0, s, s);
  for (let i = 0; i < 16; i++) {
    const x0 = 20 + r() * (s - 40);
    const h = 50 + r() * 70;
    const lean = (r() - 0.5) * 50;
    const w = 4 + r() * 4;
    const l = 26 + r() * 16;
    ctx.fillStyle = `hsl(${95 + r() * 20} ${40 + r() * 20}% ${l}%)`;
    ctx.beginPath();
    ctx.moveTo(x0 - w / 2, s);
    ctx.quadraticCurveTo(x0 + lean * 0.4, s - h * 0.6, x0 + lean, s - h);
    ctx.quadraticCurveTo(x0 + lean * 0.5, s - h * 0.55, x0 + w / 2, s);
    ctx.fill();
  }
  return tex(c, true, false);
}

/** A wooden signboard with a big letter and a caption. */
export function signTexture(letter: string, caption: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 320);
  ctx.fillStyle = '#c99a63';
  ctx.fillRect(0, 0, 512, 320);
  // wood grain
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(90, 55, 25, ${0.05 + Math.random() * 0.08})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const y = Math.random() * 320;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + (Math.random() - 0.5) * 20, 340, y + (Math.random() - 0.5) * 20, 512, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }
  ctx.strokeStyle = '#5a3a1e';
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, 496, 304);
  ctx.fillStyle = '#3b2412';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.font = '700 170px "Aref Ruqaa", "Amiri", serif';
  ctx.fillText(letter, 256, 135);
  ctx.font = '600 44px "Noto Naskh Arabic", "Amiri", serif';
  ctx.fillText(caption, 256, 262);
  return tex(c, true, false);
}

/** Floating label for a tree (used on a sprite). */
export function labelTexture(text: string, accent = false): THREE.CanvasTexture {
  const w = 256;
  const h = 96;
  const [c, ctx] = canvas(w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = accent ? 'rgba(255, 232, 160, 0.95)' : 'rgba(255, 252, 245, 0.86)';
  ctx.strokeStyle = accent ? '#b8862b' : 'rgba(80, 60, 30, 0.35)';
  ctx.lineWidth = 3;
  const r = 22;
  ctx.beginPath();
  ctx.roundRect(6, 10, w - 12, h - 20, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a221b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.font = '700 54px "Amiri", "Noto Naskh Arabic", serif';
  ctx.fillText(text, w / 2, h / 2 + 2);
  return tex(c, true, false);
}
