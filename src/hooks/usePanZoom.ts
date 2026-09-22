import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Options {
  minScale: number;
  maxScale: number;
  /** world bounds, used to keep the content reachable */
  world: WorldRect;
  initial?: (viewport: { width: number; height: number }) => Transform;
}

/**
 * Pointer/wheel/touch pan & zoom for an SVG stage.  The transform is applied by
 * the caller as `translate(x y) scale(k)`.
 */
export function usePanZoom(ref: RefObject<HTMLElement | null>, opts: Options) {
  const [t, setT] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const tRef = useRef(t);
  tRef.current = t;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const anim = useRef<number | null>(null);
  const moved = useRef(false);

  const clamp = useCallback((n: Transform): Transform => {
    const el = ref.current;
    const o = optsRef.current;
    const k = Math.min(o.maxScale, Math.max(o.minScale, n.k));
    if (!el) return { ...n, k };
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const w = o.world;
    // keep at least a quarter of the viewport covered by the world
    const range = (v: number, x0: number, len: number, val: number) => {
      const min = v * 0.25 - (x0 + len) * k;
      const max = v * 0.75 - x0 * k;
      if (min > max) return (min + max) / 2;
      return Math.min(Math.max(val, min), max);
    };
    return { k, x: range(vw, w.x, w.width, n.x), y: range(vh, w.y, w.height, n.y) };
  }, [ref]);

  const stop = () => {
    if (anim.current) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  const set = useCallback((n: Transform) => {
    stop();
    setT(clamp(n));
  }, [clamp]);

  /** animate to a transform */
  const flyTo = useCallback((target: Transform, ms = 600) => {
    stop();
    const from = tRef.current;
    const to = clamp(target);
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setT({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e });
      if (p < 1) anim.current = requestAnimationFrame(step);
      else anim.current = null;
    };
    anim.current = requestAnimationFrame(step);
  }, [clamp]);

  /** transform that fits a world rectangle into the viewport */
  const fitRect = useCallback((r: WorldRect, pad = 40): Transform => {
    const el = ref.current;
    if (!el) return tRef.current;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const k = Math.min((vw - pad * 2) / r.width, (vh - pad * 2) / r.height);
    const kk = Math.min(optsRef.current.maxScale, Math.max(optsRef.current.minScale, k));
    return { k: kk, x: (vw - r.width * kk) / 2 - r.x * kk, y: (vh - r.height * kk) / 2 - r.y * kk };
  }, [ref]);

  const zoomBy = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = ref.current;
    if (!el) return;
    const cur = tRef.current;
    const px = cx ?? el.clientWidth / 2;
    const py = cy ?? el.clientHeight / 2;
    const k = Math.min(optsRef.current.maxScale, Math.max(optsRef.current.minScale, cur.k * factor));
    const f = k / cur.k;
    flyTo({ k, x: px - (px - cur.x) * f, y: py - (py - cur.y) * f }, 250);
  }, [flyTo, ref]);

  // initial transform once the element has a size
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const init = optsRef.current.initial;
    if (init) setT(clamp(init({ width: el.clientWidth, height: el.clientHeight })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.current]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let last: { x: number; y: number } | null = null;
    let pinch: { d: number; k: number; cx: number; cy: number } | null = null;
    let downAt: { x: number; y: number } | null = null;
    let listening = false;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const cur = tRef.current;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-delta * 0.0018);
      const k = Math.min(optsRef.current.maxScale, Math.max(optsRef.current.minScale, cur.k * factor));
      const f = k / cur.k;
      stop();
      setT(clamp({ k, x: px - (px - cur.x) * f, y: py - (py - cur.y) * f }));
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) moved.current = true;
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = el.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - rect.left;
        const cy = (a.y + b.y) / 2 - rect.top;
        const cur = tRef.current;
        const k = Math.min(optsRef.current.maxScale, Math.max(optsRef.current.minScale, (pinch.k * d) / pinch.d));
        const f = k / cur.k;
        setT(clamp({ k, x: cx - (pinch.cx - cur.x) * f, y: cy - (pinch.cy - cur.y) * f }));
        pinch.cx = cx;
        pinch.cy = cy;
        return;
      }
      if (last && pointers.size === 1) {
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
        if (dx || dy) setT((cur) => clamp({ ...cur, x: cur.x + dx, y: cur.y + dy }));
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) {
        const [p] = [...pointers.values()];
        last = { x: p.x, y: p.y };
      } else last = null;
      if (pointers.size === 0 && listening) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        listening = false;
      }
    };
    // no pointer capture: capturing would retarget the click events that
    // trees and branches rely on.  Drags are tracked on the window instead.
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved.current = false;
      downAt = { x: e.clientX, y: e.clientY };
      if (pointers.size === 1) last = { x: e.clientX, y: e.clientY };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const rect = el.getBoundingClientRect();
        pinch = {
          d: Math.hypot(a.x - b.x, a.y - b.y), k: tRef.current.k,
          cx: (a.x + b.x) / 2 - rect.left, cy: (a.y + b.y) / 2 - rect.top,
        };
        last = null;
      }
      if (!listening) {
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        listening = true;
      }
      stop();
    };
    const onDbl = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const cur = tRef.current;
      const k = Math.min(optsRef.current.maxScale, cur.k * 1.8);
      const f = k / cur.k;
      flyTo({ k, x: px - (px - cur.x) * f, y: py - (py - cur.y) * f }, 350);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('dblclick', onDbl);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('dblclick', onDbl);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [ref, clamp, flyTo]);

  return { t, set, flyTo, fitRect, zoomBy, /** true if the pointer moved since it went down (so the up is a drag, not a click) */ wasDrag: () => moved.current };
}
