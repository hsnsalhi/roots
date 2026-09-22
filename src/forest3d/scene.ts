import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LETTER_NAMES, dashed } from '../roots';
import type { BiRoot } from '../types';
import { layout3D, type Grove3D, type Layout3D, type Tree3D } from './layout3d';
import { rng } from './noise';
import { TERRAIN_SIZE, buildTerrain, terrainHeight } from './terrain';
import { barkTexture, grassTexture, labelTexture, leafTexture, plaqueTexture, signTexture } from './textures';
import { buildVariantSet, disposeVariants, type Quality, type VariantSet } from './treeGen';

export interface SceneCallbacks {
  onHover: (tree: Tree3D | null, screen: { x: number; y: number } | null) => void;
  onSelect: (tree: Tree3D) => void;
  onCamera?: (info: CameraInfo) => void;
}

export interface CameraInfo {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  distance: number;
}

interface Palette {
  skyTop: string;
  skyHorizon: string;
  ground: string;
  fog: string;
  sun: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  exposure: number;
  stars: number;
  sunPos: [number, number, number];
}

const DAY: Palette = {
  skyTop: '#4a8ddb', skyHorizon: '#cfe0ee', ground: '#b9c9a8', fog: '#cddceb', sun: '#fff1d6', sunIntensity: 2.3,
  hemiSky: '#b7d3f0', hemiGround: '#55643a', hemiIntensity: 0.85, exposure: 1.0, stars: 0, sunPos: [0.45, 0.72, 0.5],
};
const NIGHT: Palette = {
  skyTop: '#0a1a33', skyHorizon: '#2a4468', ground: '#101a2a', fog: '#182a44', sun: '#c4d6ff', sunIntensity: 2.0,
  hemiSky: '#5a7ab0', hemiGround: '#243424', hemiIntensity: 1.25, exposure: 1.05, stars: 1, sunPos: [-0.4, 0.62, 0.35],
};
const FOG_DAY = 0.00045;
const FOG_NIGHT = 0.0007;

const lin = (hex: string) => new THREE.Color(hex);

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class ForestScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private cb: SceneCallbacks;
  private container: HTMLElement;
  private quality: Quality;
  private variants: VariantSet | null = null;
  private layout: Layout3D | null = null;
  private forest = new THREE.Group();
  private labels = new THREE.Group();
  private plaques = new THREE.Group();
  private instanceOwners = new Map<THREE.Object3D, Tree3D[]>();
  private treeInstance = new Map<Tree3D, { trunk: THREE.InstancedMesh; leaves: THREE.InstancedMesh; index: number; sprite: THREE.Sprite; leafColor: THREE.Color; trunkColor: THREE.Color }>();
  private hovered: Tree3D | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDown: { x: number; y: number } | null = null;
  private needsHoverCheck = false;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  private stars: THREE.Points;
  private skyUniforms: Record<string, THREE.IUniform>;
  private uTime = { value: 0 };
  private barkMat: THREE.MeshStandardMaterial;
  private leafMat: THREE.MeshStandardMaterial;
  private tween: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; start: number; ms: number } | null = null;
  private disposed = false;
  private night = false;
  private clock = new THREE.Clock();
  private lastCamKey = '';
  private grassMesh: THREE.InstancedMesh | null = null;
  private ready = false;
  private lastHoverCheck = 0;
  /** rendered frame counter (handy for tests) */
  frames = 0;

  constructor(container: HTMLElement, cb: SceneCallbacks) {
    this.container = container;
    this.cb = cb;
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.quality = coarse || container.clientWidth < 800 ? 'low' : 'high';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === 'high' ? 1.75 : 1.25));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = this.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.5, 5000);
    this.camera.position.set(0, 260, 520);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 1200;
    this.controls.screenSpacePanning = false;
    this.controls.zoomSpeed = 1.1;
    this.controls.target.set(0, 0, 0);

    this.scene.fog = new THREE.FogExp2(lin(DAY.fog), FOG_DAY);
    this.hemi = new THREE.HemisphereLight(lin(DAY.hemiSky), lin(DAY.hemiGround), DAY.hemiIntensity);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(lin(DAY.sun), DAY.sunIntensity);
    this.sun.castShadow = this.quality === 'high';
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -170; sc.right = 170; sc.top = 170; sc.bottom = -170; sc.near = 10; sc.far = 900;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // sky dome
    this.skyUniforms = {
      top: { value: lin(DAY.skyTop) }, horizon: { value: lin(DAY.skyHorizon) }, ground: { value: lin(DAY.ground) },
      sunDir: { value: new THREE.Vector3(...DAY.sunPos).normalize() }, sunColor: { value: lin('#fff4d8') }, glow: { value: 1 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(2600, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor; uniform float glow; varying vec3 vDir;
          void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, ground, pow(-h, 0.5));
            float d = max(dot(normalize(vDir), sunDir), 0.0); c += sunColor * (pow(d, 400.0) * 1.4 + pow(d, 8.0) * 0.12) * glow;
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    // stars (night)
    const starGeo = new THREE.BufferGeometry();
    const sr = rng(99);
    const sp = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const th = sr() * Math.PI * 2;
      const ph = Math.acos(sr() * 0.9 + 0.08);
      sp[i * 3] = Math.sin(ph) * Math.cos(th) * 2400;
      sp[i * 3 + 1] = Math.cos(ph) * 2400;
      sp[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 2400;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 5, sizeAttenuation: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);

    this.barkMat = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95, metalness: 0 });
    this.leafMat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
    const uTime = this.uTime;
    this.leafMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      // keep the canopy normals as authored on both faces of a leaf quad
      shader.fragmentShader = shader.fragmentShader.replace('normal *= faceDirection;', '').replace('normal = normal * faceDirection;', '');
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float phase = float(gl_InstanceID) * 0.37;
          float lift = clamp(position.y * 0.12, 0.0, 1.0);
          float sway = sin(uTime * 1.1 + phase + position.x * 0.6) * 0.09 + sin(uTime * 2.3 + phase * 1.7 + position.z * 0.8) * 0.045;
          transformed.x += sway * lift;
          transformed.z += sway * 0.6 * lift;`,
        );
    };

    this.scene.add(this.forest);
    this.scene.add(this.labels);
    this.scene.add(this.plaques);

    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', () => this.setHover(null));
  }

  async init() {
    try {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      /* ignore */
    }
    if (this.disposed) return;
    this.variants = buildVariantSet(this.quality);
    this.scene.add(buildTerrain());
    this.addGrass();
    this.ready = true;
    this.renderer.setAnimationLoop(this.loop);
  }

  isReady() {
    return this.ready;
  }

  private addGrass() {
    const n = this.quality === 'high' ? 6000 : 2200;
    const plane = new THREE.PlaneGeometry(1.6, 1.3);
    plane.translate(0, 0.62, 0);
    const cross = plane.clone().rotateY(Math.PI / 2);
    const g = new THREE.BufferGeometry();
    const p1 = plane.attributes.position.array as Float32Array;
    const p2 = cross.attributes.position.array as Float32Array;
    const u1 = plane.attributes.uv.array as Float32Array;
    const idx = Array.from(plane.index!.array as ArrayLike<number>);
    const pos = new Float32Array([...p1, ...p2]);
    const uv = new Float32Array([...u1, ...u1]);
    const nrm = new Float32Array(pos.length).fill(0);
    for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setIndex([...idx, ...idx.map((i) => i + p1.length / 3)]);
    const mat = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
    const mesh = new THREE.InstancedMesh(g, mat, n);
    const r = rng(5);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const v = new THREE.Vector3();
    const half = TERRAIN_SIZE * 0.42;
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 2 * half;
      const z = (r() - 0.5) * 2 * half;
      v.set(x, terrainHeight(x, z) - 0.1, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI);
      const k = 0.8 + r() * 1.2;
      s.set(k, k, k);
      mesh.setMatrixAt(i, m.compose(v, q, s));
    }
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.grassMesh = mesh;
  }

  /** (re)build the forest for a set of biliteral roots */
  setTrees(bis: BiRoot[]) {
    if (!this.variants) return;
    this.clearForest();
    const layout = layout3D(bis, this.variants.trees.length, this.variants.shrubs.length);
    this.layout = layout;
    const groups = new Map<string, Tree3D[]>();
    for (const t of layout.trees) {
      const key = (t.shrub ? 's' : 't') + t.variant;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const r = rng(11);
    for (const [key, trees] of groups) {
      const variant = key[0] === 's' ? this.variants.shrubs[Number(key.slice(1))] : this.variants.trees[Number(key.slice(1))];
      const trunk = new THREE.InstancedMesh(variant.trunk, this.barkMat, trees.length);
      const leaves = new THREE.InstancedMesh(variant.leaves, this.leafMat, trees.length);
      trunk.castShadow = leaves.castShadow = this.quality === 'high';
      trunk.receiveShadow = true;
      trees.forEach((t, i) => {
        const k = t.height / variant.top;
        p.set(t.x, t.y, t.z);
        q.setFromAxisAngle(up, t.rotation);
        s.set(k * t.sx, k, k * t.sz);
        m.compose(p, q, s);
        trunk.setMatrixAt(i, m);
        leaves.setMatrixAt(i, m);
        const hue = 0.24 + (r() - 0.5) * 0.06 + (t.shrub ? 0.02 : 0);
        const leafColor = new THREE.Color().setHSL(hue, 0.5 + r() * 0.25, 0.36 + r() * 0.2);
        const trunkColor = new THREE.Color().setHSL(0.08, 0.25, 0.7 + r() * 0.3);
        leaves.setColorAt(i, leafColor);
        trunk.setColorAt(i, trunkColor);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(dashed(t.bi.id)), depthTest: true, transparent: true, fog: false, toneMapped: false }));
        sprite.position.set(t.x, t.y + t.height + (t.shrub ? 1.4 : 1.8), t.z);
        sprite.scale.set(7, 2.6, 1);
        sprite.userData.tree = t;
        this.labels.add(sprite);
        if (t.bi.meaning) {
          // the general meaning of the group, on a plaque at the foot of the tree
          const plaque = new THREE.Sprite(new THREE.SpriteMaterial({ map: plaqueTexture(t.bi.meaning), depthTest: true, transparent: true, fog: false, toneMapped: false }));
          plaque.position.set(t.x, t.y + (t.shrub ? 1.1 : 1.9), t.z);
          plaque.scale.set(t.shrub ? 6.5 : 8.5, t.shrub ? 2.2 : 2.9, 1);
          plaque.userData.tree = t;
          plaque.userData.base = plaque.position.clone();
          this.plaques.add(plaque);
        }
        this.treeInstance.set(t, { trunk, leaves, index: i, sprite, leafColor, trunkColor });
      });
      trunk.instanceMatrix.needsUpdate = true;
      leaves.instanceMatrix.needsUpdate = true;
      if (trunk.instanceColor) trunk.instanceColor.needsUpdate = true;
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      this.forest.add(trunk, leaves);
      this.instanceOwners.set(trunk, trees);
      this.instanceOwners.set(leaves, trees);
    }
    for (const g of layout.groves) this.forest.add(this.makeSign(g));
    if (this.quality === 'low') this.forest.add(this.makeBlobs(layout.trees));
    this.addAmbient(layout);
    if (!this.lastCamKey) this.fitAll(false);
  }

  /** a belt of wild trees around the groves and bushes in the meadows (decor, not clickable) */
  private addAmbient(layout: Layout3D) {
    if (!this.variants) return;
    const r = rng(23);
    const b = layout.bounds;
    const margin = this.quality === 'high' ? 190 : 140;
    const inner = 26;
    const beltCount = this.quality === 'high' ? 450 : 240;
    const bushCount = this.quality === 'high' ? 260 : 120;
    const groups = new Map<string, { x: number; z: number; h: number; rot: number }[]>();
    const push = (key: string, item: { x: number; z: number; h: number; rot: number }) => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    };
    let tries = 0;
    while (groups.size < 0 || (tries < beltCount * 6 && [...groups.values()].reduce((s, g) => s + g.filter(Boolean).length, 0) < beltCount)) {
      tries++;
      const x = b.minX - margin + r() * (b.maxX - b.minX + margin * 2);
      const z = b.minZ - margin + r() * (b.maxZ - b.minZ + margin * 2);
      const insideInner = x > b.minX - inner && x < b.maxX + inner && z > b.minZ - inner && z < b.maxZ + inner;
      if (insideInner) continue;
      push('t' + Math.floor(r() * this.variants.trees.length), { x, z, h: 8 + r() * 11, rot: r() * Math.PI * 2 });
    }
    let bushes = 0;
    tries = 0;
    while (bushes < bushCount && tries < bushCount * 8) {
      tries++;
      const x = b.minX - 40 + r() * (b.maxX - b.minX + 80);
      const z = b.minZ - 40 + r() * (b.maxZ - b.minZ + 80);
      if (layout.groves.some((g) => Math.hypot(g.cx - x, g.cz - z) < g.radius + 5)) continue;
      push('s' + Math.floor(r() * this.variants.shrubs.length), { x, z, h: 1.6 + r() * 1.6, rot: r() * Math.PI * 2 });
      bushes++;
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [key, items] of groups) {
      const variant = key[0] === 's' ? this.variants.shrubs[Number(key.slice(1))] : this.variants.trees[Number(key.slice(1))];
      const trunk = new THREE.InstancedMesh(variant.trunk, this.barkMat, items.length);
      const leaves = new THREE.InstancedMesh(variant.leaves, this.leafMat, items.length);
      trunk.castShadow = leaves.castShadow = this.quality === 'high';
      trunk.receiveShadow = true;
      items.forEach((it, i) => {
        const k = it.h / variant.top;
        p.set(it.x, terrainHeight(it.x, it.z), it.z);
        q.setFromAxisAngle(up, it.rot);
        sc.set(k * (0.9 + r() * 0.2), k, k * (0.9 + r() * 0.2));
        trunk.setMatrixAt(i, m.compose(p, q, sc));
        leaves.setMatrixAt(i, m);
        leaves.setColorAt(i, new THREE.Color().setHSL(0.25 + (r() - 0.5) * 0.05, 0.42 + r() * 0.2, 0.3 + r() * 0.16));
        trunk.setColorAt(i, new THREE.Color().setHSL(0.08, 0.2, 0.6 + r() * 0.25));
      });
      trunk.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
      trunk.name = leaves.name = 'ambient';
      this.forest.add(trunk, leaves);
    }
  }

  /** soft dark discs under the trees, used when real shadows are disabled */
  private makeBlobs(trees: Tree3D[]): THREE.InstancedMesh {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.42)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, trees.length);
    const m = new THREE.Matrix4();
    trees.forEach((t, i) => {
      const r = t.shrub ? 3.2 : t.height * 0.7;
      m.makeScale(r, 1, r).setPosition(t.x, t.y + 0.08, t.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.renderOrder = 1;
    mesh.name = 'blobs';
    return mesh;
  }

  private makeSign(g: Grove3D): THREE.Group {
    const group = new THREE.Group();
    const y = terrainHeight(g.signX, g.signZ);
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 5.2, 8), wood);
    post.position.set(0, 2.5, 0);
    post.castShadow = true;
    const face = new THREE.MeshStandardMaterial({ map: signTexture(g.letter, `بستان ${LETTER_NAMES[g.letter]}`), roughness: 0.8, toneMapped: false });
    const board = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4, 0.22), [wood, wood, wood, wood, face, wood]);
    board.position.set(0, 5.4, 0.14);
    board.castShadow = true;
    group.add(post, board);
    group.position.set(g.signX, y, g.signZ);
    group.userData.grove = g.letter;
    return group;
  }

  private clearForest() {
    this.setHover(null);
    for (const child of [...this.forest.children]) {
      this.forest.remove(child);
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh) {
          mesh.geometry.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mt of mats) {
            const std = mt as THREE.MeshStandardMaterial;
            if (std.map && std !== this.barkMat && std !== this.leafMat) std.map.dispose();
            if (mt !== this.barkMat && mt !== this.leafMat) mt.dispose();
          }
        }
        if ((o as THREE.InstancedMesh).isInstancedMesh) {
          const im = o as THREE.InstancedMesh;
          im.dispose();
          if (im.name === 'blobs') {
            im.geometry.dispose();
            const bm = im.material as THREE.MeshBasicMaterial;
            bm.map?.dispose();
            bm.dispose();
          }
        }
      });
    }
    for (const group of [this.labels, this.plaques]) {
      for (const sprite of [...group.children] as THREE.Sprite[]) {
        group.remove(sprite);
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
    }
    this.instanceOwners.clear();
    this.treeInstance.clear();
  }

  getLayout() {
    return this.layout;
  }

  setNight(night: boolean) {
    this.night = night;
    const pal = night ? NIGHT : DAY;
    (this.scene.fog as THREE.FogExp2).color.set(pal.fog);
    (this.scene.fog as THREE.FogExp2).density = night ? FOG_NIGHT : FOG_DAY;
    this.hemi.color.set(pal.hemiSky);
    this.hemi.groundColor.set(pal.hemiGround);
    this.hemi.intensity = pal.hemiIntensity;
    this.sun.color.set(pal.sun);
    this.sun.intensity = pal.sunIntensity;
    this.skyUniforms.top.value.set(pal.skyTop);
    this.skyUniforms.horizon.value.set(pal.skyHorizon);
    this.skyUniforms.ground.value.set(pal.ground);
    this.skyUniforms.sunDir.value.set(...pal.sunPos).normalize();
    this.skyUniforms.sunColor.value.set(night ? '#dfe8ff' : '#fff4d8');
    this.skyUniforms.glow.value = night ? 0.5 : 1;
    (this.stars.material as THREE.PointsMaterial).opacity = pal.stars;
    this.renderer.toneMappingExposure = pal.exposure;
  }

  // ---------------------------------------------------------------- camera
  private flyTo(camPos: THREE.Vector3, target: THREE.Vector3, ms = 1100) {
    this.tween = { from: this.camera.position.clone(), to: camPos, tFrom: this.controls.target.clone(), tTo: target, start: performance.now(), ms };
  }

  fitAll(animate = true) {
    if (!this.layout) return;
    const b = this.layout.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    const dist = (span * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360) / Math.min(1, aspect) + 40;
    const target = new THREE.Vector3(cx, terrainHeight(cx, cz) + 4, cz - span * 0.08);
    const pos = new THREE.Vector3(cx + span * 0.05, dist * 0.42, cz + dist * 0.95);
    if (animate) this.flyTo(pos, target, 1200);
    else {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
    }
    this.lastCamKey = 'all';
  }

  flyToGrove(letter: string, ms = 1300) {
    const g = this.layout?.groves.find((x) => x.letter === letter);
    if (!g) return;
    const target = new THREE.Vector3(g.cx, terrainHeight(g.cx, g.cz) + 6, g.cz);
    const d = g.radius * 2.1 + 26;
    const pos = new THREE.Vector3(g.cx + d * 0.15, d * 0.55 + 8, g.cz + d * 0.95);
    this.flyTo(pos, target, ms);
    this.lastCamKey = 'g' + letter;
  }

  flyToTree(t: Tree3D, ms = 900) {
    const target = new THREE.Vector3(t.x, t.y + t.height * 0.55, t.z);
    const dir = new THREE.Vector3().subVectors(this.camera.position, target).setY(0).normalize();
    if (!dir.lengthSq()) dir.set(0, 0, 1);
    const d = t.height * 2.2 + 8;
    const pos = target.clone().addScaledVector(dir, d).add(new THREE.Vector3(0, t.height * 0.5, 0));
    this.flyTo(pos, target, ms);
  }

  lookAtPoint(x: number, z: number) {
    const target = new THREE.Vector3(x, terrainHeight(x, z) + 4, z);
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    this.flyTo(target.clone().add(offset), target, 700);
  }

  zoomBy(f: number) {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const len = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, offset.length() / f));
    offset.setLength(len);
    this.flyTo(this.controls.target.clone().add(offset), this.controls.target.clone(), 350);
  }

  // ---------------------------------------------------------------- pointer
  private onPointerMove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const now = performance.now();
    if (!this.pointerDown && now - this.lastHoverCheck > 50) {
      this.lastHoverCheck = now;
      this.needsHoverCheck = false;
      this.setHover(this.pick());
    } else this.needsHoverCheck = true;
  };
  private onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };
  private onPointerUp = (e: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const hit = this.pick();
    if (hit) this.cb.onSelect(hit);
  };

  private pick(): Tree3D | null {
    if (!this.layout) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [...this.labels.children, ...this.plaques.children, ...this.forest.children.filter((o) => (o as THREE.InstancedMesh).isInstancedMesh && this.instanceOwners.has(o))];
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const h of hits) {
      if ((h.object as THREE.Sprite).isSprite) return h.object.userData.tree as Tree3D;
      const owners = this.instanceOwners.get(h.object);
      if (owners && h.instanceId !== undefined) return owners[h.instanceId];
    }
    return null;
  }

  private setHover(t: Tree3D | null) {
    if (t === this.hovered) return;
    if (this.hovered) {
      const inst = this.treeInstance.get(this.hovered);
      if (inst) {
        inst.leaves.setColorAt(inst.index, inst.leafColor);
        inst.trunk.setColorAt(inst.index, inst.trunkColor);
        inst.leaves.instanceColor!.needsUpdate = true;
        inst.trunk.instanceColor!.needsUpdate = true;
        inst.sprite.scale.set(7, 2.6, 1);
      }
    }
    this.hovered = t;
    if (t) {
      const inst = this.treeInstance.get(t);
      if (inst) {
        inst.leaves.setColorAt(inst.index, inst.leafColor.clone().multiplyScalar(1.45));
        inst.trunk.setColorAt(inst.index, inst.trunkColor.clone().multiplyScalar(1.25));
        inst.leaves.instanceColor!.needsUpdate = true;
        inst.trunk.instanceColor!.needsUpdate = true;
        inst.sprite.scale.set(8.6, 3.2, 1);
      }
    }
    this.renderer.domElement.style.cursor = t ? 'pointer' : 'grab';
    this.cb.onHover(t, t ? this.screenPos(t) : null);
  }

  private screenPos(t: Tree3D): { x: number; y: number } {
    const v = new THREE.Vector3(t.x, t.y + t.height + 2.5, t.z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.container.clientWidth, y: ((1 - v.y) / 2) * this.container.clientHeight };
  }

  // ---------------------------------------------------------------- loop
  private loop = () => {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.uTime.value += dt;
    if (this.tween) {
      const p = Math.min(1, (performance.now() - this.tween.start) / this.tween.ms);
      const e = easeInOut(p);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, e);
      this.controls.target.lerpVectors(this.tween.tFrom, this.tween.tTo, e);
      if (p >= 1) this.tween = null;
    }
    this.controls.update();
    // never dive under the ground
    const minY = terrainHeight(this.camera.position.x, this.camera.position.z) + 1.6;
    if (this.camera.position.y < minY) this.camera.position.y = minY;
    // sun & sky follow the viewer
    const tgt = this.controls.target;
    const pal = this.night ? NIGHT : DAY;
    this.sun.position.set(tgt.x + pal.sunPos[0] * 420, tgt.y + pal.sunPos[1] * 420, tgt.z + pal.sunPos[2] * 420);
    this.sun.target.position.copy(tgt);
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    // label fading with distance
    const camPos = this.camera.position;
    for (const sprite of this.labels.children as THREE.Sprite[]) {
      const d = sprite.position.distanceTo(camPos);
      const o = d < 110 ? 1 : d > 260 ? 0 : 1 - (d - 110) / 150;
      const mat = sprite.material;
      if (Math.abs(mat.opacity - o) > 0.01) mat.opacity = o;
      sprite.visible = o > 0.02;
    }
    const toCam = new THREE.Vector3();
    for (const sprite of this.plaques.children as THREE.Sprite[]) {
      const base = sprite.userData.base as THREE.Vector3;
      const d = base.distanceTo(camPos);
      const o = d < 55 ? 1 : d > 120 ? 0 : 1 - (d - 55) / 65;
      const mat = sprite.material;
      if (Math.abs(mat.opacity - o) > 0.01) mat.opacity = o;
      sprite.visible = o > 0.02;
      if (sprite.visible) {
        // keep the plaque just in front of the trunk, on the viewer's side
        toCam.subVectors(camPos, base).setY(0).normalize();
        sprite.position.copy(base).addScaledVector(toCam, 1.6);
      }
    }
    if (this.needsHoverCheck && !this.pointerDown) {
      this.needsHoverCheck = false;
      this.setHover(this.pick());
    } else if (this.hovered) {
      this.cb.onHover(this.hovered, this.screenPos(this.hovered));
    }
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    if (this.cb.onCamera) {
      const dir = new THREE.Vector3().subVectors(tgt, camPos).setY(0).normalize();
      const key = `${camPos.x.toFixed(1)},${camPos.z.toFixed(1)},${dir.x.toFixed(2)},${dir.z.toFixed(2)}`;
      if (key !== this.lastCamKey) {
        this.lastCamKey = key;
        this.cb.onCamera({ x: camPos.x, z: camPos.z, dirX: dir.x, dirZ: dir.z, distance: camPos.distanceTo(tgt) });
      }
    }
  };

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerup', this.onPointerUp);
    this.clearForest();
    if (this.variants) disposeVariants(this.variants);
    this.grassMesh?.geometry.dispose();
    (this.grassMesh?.material as THREE.Material | undefined)?.dispose();
    this.barkMat.map?.dispose();
    this.leafMat.map?.dispose();
    this.barkMat.dispose();
    this.leafMat.dispose();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.name === 'terrain') {
        mesh.geometry.dispose();
        const mt = mesh.material as THREE.MeshStandardMaterial;
        mt.map?.dispose();
        mt.dispose();
      }
    });
    this.renderer.dispose();
    el.remove();
  }
}
