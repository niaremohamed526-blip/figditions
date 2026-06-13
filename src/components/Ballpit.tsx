/* eslint-disable @typescript-eslint/no-explicit-any */
// Ballpit component — adapted from reactbits.dev
import { useEffect, useRef } from "react";
import {
  Clock,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  SRGBColorSpace,
  MathUtils,
  Vector2,
  Vector3,
  MeshPhysicalMaterial,
  Color,
  Object3D,
  InstancedMesh,
  PMREMGenerator,
  SphereGeometry,
  AmbientLight,
  PointLight,
  ACESFilmicToneMapping,
  Raycaster,
  Plane,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

class ThreeBase {
  canvas: HTMLCanvasElement;
  camera: PerspectiveCamera;
  cameraMinAspect?: number;
  cameraMaxAspect?: number;
  cameraFov!: number;
  maxPixelRatio: number;
  minPixelRatio: number;
  scene: Scene;
  renderer: WebGLRenderer;
  size = { width: 0, height: 0, wWidth: 0, wHeight: 0, ratio: 0, pixelRatio: 0 };
  clock = new Clock();
  time = { elapsed: 0, delta: 0 };
  #onUpdate?: (time: any) => void;
  #ro?: ResizeObserver;
  #raf?: number;
  #isIntersecting = false;
  #io?: IntersectionObserver;

  constructor(params: any) {
    this.canvas = params.canvas;
    this.camera = new PerspectiveCamera();
    this.cameraFov = this.camera.fov;
    this.maxPixelRatio = params.maxPixelRatio ?? 2;
    this.minPixelRatio = params.minPixelRatio ?? 1;
    this.scene = new Scene();
    this.renderer = new WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.#initObservers();
  }
  #initObservers() {
    this.#ro = new ResizeObserver(() => this.resize());
    this.#ro.observe(this.canvas);
    this.#io = new IntersectionObserver((entries) => {
      this.#isIntersecting = entries[0].isIntersecting;
      if (this.#isIntersecting) this.#start();
      else this.#stop();
    });
    this.#io.observe(this.canvas);
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const ratio = w / h;
    if (this.cameraMinAspect && ratio < this.cameraMinAspect) {
      this.camera.fov = 2 * MathUtils.radToDeg(Math.atan(Math.tan(MathUtils.degToRad(this.cameraFov) / 2) / ratio * this.cameraMinAspect));
    } else if (this.cameraMaxAspect && ratio > this.cameraMaxAspect) {
      this.camera.fov = this.cameraFov;
    } else {
      this.camera.fov = this.cameraFov;
    }
    this.camera.aspect = ratio;
    this.camera.updateProjectionMatrix();
    const pixelRatio = Math.min(Math.max(window.devicePixelRatio, this.minPixelRatio), this.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    const vFov = MathUtils.degToRad(this.camera.fov);
    const wHeight = 2 * Math.tan(vFov / 2) * this.camera.position.length();
    const wWidth = wHeight * ratio;
    this.size = { width: w, height: h, wWidth, wHeight, ratio, pixelRatio };
  }
  onUpdate(cb: (t: any) => void) { this.#onUpdate = cb; }
  #start() {
    if (this.#raf) return;
    this.clock.start();
    const tick = () => {
      this.time.delta = this.clock.getDelta();
      this.time.elapsed += this.time.delta;
      this.#onUpdate?.(this.time);
      this.renderer.render(this.scene, this.camera);
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }
  #stop() {
    if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = undefined; }
    this.clock.stop();
  }
  dispose() {
    this.#stop();
    this.#ro?.disconnect();
    this.#io?.disconnect();
    this.renderer.dispose();
  }
}

class PointerHandler {
  position = new Vector2();
  nPosition = new Vector2();
  isHover = false;
  el: HTMLElement;
  onMove?: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  #handlers: any;
  constructor(params: any) {
    this.el = params.domElement;
    this.onMove = params.onMove;
    this.onEnter = params.onEnter;
    this.onLeave = params.onLeave;
    this.#handlers = {
      move: (e: PointerEvent) => {
        const rect = this.el.getBoundingClientRect();
        this.position.set(e.clientX - rect.left, e.clientY - rect.top);
        this.nPosition.set((this.position.x / rect.width) * 2 - 1, (-this.position.y / rect.height) * 2 + 1);
        this.onMove?.();
      },
      enter: () => { this.isHover = true; this.onEnter?.(); },
      leave: () => { this.isHover = false; this.onLeave?.(); },
    };
    this.el.addEventListener("pointermove", this.#handlers.move);
    this.el.addEventListener("pointerenter", this.#handlers.enter);
    this.el.addEventListener("pointerleave", this.#handlers.leave);
  }
  dispose() {
    this.el.removeEventListener("pointermove", this.#handlers.move);
    this.el.removeEventListener("pointerenter", this.#handlers.enter);
    this.el.removeEventListener("pointerleave", this.#handlers.leave);
  }
}

const defaultConfig = {
  count: 200,
  colors: [0, 0, 0],
  ambientColor: 0xffffff,
  ambientIntensity: 1,
  lightIntensity: 200,
  materialParams: { metalness: 0.5, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.15 },
  minSize: 0.5,
  maxSize: 1,
  size0: 1,
  gravity: 0.5,
  friction: 0.9975,
  wallBounce: 0.95,
  maxVelocity: 0.15,
  maxX: 5,
  maxY: 5,
  maxZ: 2,
  controlSphere0: false,
  followCursor: true,
};

class PhysicsSim {
  config: any;
  positionData: Float32Array;
  velocityData: Float32Array;
  sizeData: Float32Array;
  center = new Vector3();
  constructor(config: any) {
    this.config = config;
    this.positionData = new Float32Array(3 * config.count).fill(0);
    this.velocityData = new Float32Array(3 * config.count).fill(0);
    this.sizeData = new Float32Array(config.count).fill(1);
    this.center.set(0, 0, 0);
    this.init();
  }
  init() {
    const { config, positionData } = this;
    this.sizeData[0] = config.size0;
    for (let i = 1; i < config.count; i++) {
      this.sizeData[i] = MathUtils.randFloat(config.minSize, config.maxSize);
      positionData[3 * i] = MathUtils.randFloatSpread(2 * config.maxX);
      positionData[3 * i + 1] = MathUtils.randFloatSpread(2 * config.maxY);
      positionData[3 * i + 2] = MathUtils.randFloatSpread(2 * config.maxZ);
    }
  }
  update(deltaInfo: any) {
    const { config, positionData, sizeData, velocityData, center } = this;
    let startIdx = 0;
    if (config.controlSphere0) {
      startIdx = 1;
      const p = new Vector3().fromArray(positionData, 0);
      p.lerp(center, 0.1);
      p.toArray(positionData, 0);
      new Vector3(0, 0, 0).toArray(velocityData, 0);
    }
    for (let i = startIdx; i < config.count; i++) {
      const base = 3 * i;
      const pos = new Vector3().fromArray(positionData, base);
      const vel = new Vector3().fromArray(velocityData, base);
      vel.y -= deltaInfo.delta * config.gravity * sizeData[i];
      vel.multiplyScalar(config.friction);
      vel.clampLength(0, config.maxVelocity);
      pos.add(vel);
      pos.toArray(positionData, base);
      vel.toArray(velocityData, base);
    }
    for (let i = startIdx; i < config.count; i++) {
      const base = 3 * i;
      const pos = new Vector3().fromArray(positionData, base);
      const vel = new Vector3().fromArray(velocityData, base);
      const r = sizeData[i];
      for (let j = i + 1; j < config.count; j++) {
        const baseJ = 3 * j;
        const pos2 = new Vector3().fromArray(positionData, baseJ);
        const vel2 = new Vector3().fromArray(velocityData, baseJ);
        const diff = pos2.clone().sub(pos);
        const dist = diff.length();
        const sumR = r + sizeData[j];
        if (dist < sumR) {
          const overlap = sumR - dist;
          const dir = diff.normalize().multiplyScalar(0.5 * overlap);
          const vCorr = dir.clone().multiplyScalar(Math.max(vel.length(), 1));
          pos.sub(dir); pos2.add(dir);
          vel.sub(vCorr); vel2.add(vCorr);
          pos.toArray(positionData, base);
          pos2.toArray(positionData, baseJ);
          vel.toArray(velocityData, base);
          vel2.toArray(velocityData, baseJ);
        }
      }
      if (config.controlSphere0) {
        const diff = new Vector3().fromArray(positionData, 0).sub(pos);
        const d = diff.length();
        const sumR0 = sizeData[i] + sizeData[0];
        if (d < sumR0) {
          const overlap = sumR0 - d;
          const dir = diff.normalize().multiplyScalar(0.5 * overlap);
          const vCorr = dir.clone().multiplyScalar(Math.max(vel.length(), 2));
          pos.sub(dir); vel.sub(vCorr);
          pos.toArray(positionData, base);
          vel.toArray(velocityData, base);
        }
      }
      if (Math.abs(pos.x) + r > config.maxX) { pos.x = Math.sign(pos.x) * (config.maxX - r); vel.x = -vel.x * config.wallBounce; }
      if (Math.abs(pos.y) + r > config.maxY) { pos.y = Math.sign(pos.y) * (config.maxY - r); vel.y = -vel.y * config.wallBounce; }
      if (Math.abs(pos.z) + r > config.maxZ) { pos.z = Math.sign(pos.z) * (config.maxZ - r); vel.z = -vel.z * config.wallBounce; }
      pos.toArray(positionData, base);
      vel.toArray(velocityData, base);
    }
  }
}

class Balls extends InstancedMesh {
  config: any;
  physics: PhysicsSim;
  ambientLight: AmbientLight;
  light: PointLight;
  constructor(renderer: WebGLRenderer, params: any) {
    const config = { ...defaultConfig, ...params };
    const env = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(env).texture;
    const geo = new SphereGeometry();
    const mat = new MeshPhysicalMaterial({ envMap, ...config.materialParams });
    mat.envMapRotation.x = -Math.PI / 2;
    super(geo, mat, config.count);
    this.config = config;
    this.physics = new PhysicsSim(config);
    this.ambientLight = new AmbientLight(config.ambientColor, config.ambientIntensity);
    this.add(this.ambientLight);
    this.light = new PointLight(config.colors[0], config.lightIntensity);
    this.add(this.light);
    this.setColors(config.colors);
  }
  setColors(colors: number[]) {
    if (Array.isArray(colors) && colors.length > 1) {
      const tmpC = (() => {
        const a = colors.map((c) => new Color(c));
        return (t: number) => {
          const idx = Math.floor(t * (a.length - 1));
          const c0 = a[idx];
          const c1 = a[idx + 1] || a[idx];
          const f = t * (a.length - 1) - idx;
          return c0.clone().lerp(c1, f);
        };
      })();
      for (let i = 0; i < this.count; i++) {
        this.setColorAt(i, tmpC(i / this.count));
      }
      if (this.instanceColor) this.instanceColor.needsUpdate = true;
    }
  }
  update(deltaInfo: any) {
    this.physics.update(deltaInfo);
    const dummy = new Object3D();
    for (let i = 0; i < this.count; i++) {
      dummy.position.fromArray(this.physics.positionData, 3 * i);
      if (i === 0 && this.config.size0 === 0) dummy.scale.setScalar(0);
      else dummy.scale.setScalar(this.physics.sizeData[i]);
      dummy.updateMatrix();
      this.setMatrixAt(i, dummy.matrix);
      if (i === 0) this.light.position.copy(dummy.position);
    }
    this.instanceMatrix.needsUpdate = true;
  }
}

function createBallpit(canvas: HTMLCanvasElement, config: any = {}) {
  const three = new ThreeBase({ canvas, ...config });
  three.renderer.toneMapping = ACESFilmicToneMapping;
  three.camera.position.set(0, 0, 20);
  three.camera.lookAt(0, 0, 0);
  three.cameraMaxAspect = 1.5;
  three.resize();
  const balls = new Balls(three.renderer, config);
  three.scene.add(balls);
  let pointer: PointerHandler | undefined;
  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const intersect = new Vector3();
  if (config.followCursor !== false) {
    pointer = new PointerHandler({
      domElement: canvas,
      onMove: () => {
        raycaster.setFromCamera(pointer!.nPosition, three.camera);
        raycaster.ray.intersectPlane(plane, intersect);
        balls.physics.center.copy(intersect);
        balls.config.controlSphere0 = true;
      },
      onLeave: () => { balls.config.controlSphere0 = false; },
    });
  }
  three.onUpdate((t) => balls.update(t));
  return {
    dispose: () => { pointer?.dispose(); three.dispose(); },
  };
}

interface BallpitProps extends React.HTMLAttributes<HTMLCanvasElement> {
  count?: number;
  colors?: number[];
  ambientColor?: number;
  ambientIntensity?: number;
  lightIntensity?: number;
  minSize?: number;
  maxSize?: number;
  gravity?: number;
  friction?: number;
  wallBounce?: number;
  followCursor?: boolean;
}

export default function Ballpit({ className = "", style, ...props }: BallpitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const instance = createBallpit(canvasRef.current, props);
    return () => instance.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", willChange: "transform", ...style }}
    />
  );
}
