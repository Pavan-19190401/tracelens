'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const SIM_VERTEX = `varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

uniform vec2 uTexel;

void main() {
  vUv = uv;
  vL = uv - vec2(uTexel.x, 0.0);
  vR = uv + vec2(uTexel.x, 0.0);
  vT = uv + vec2(0.0, uTexel.y);
  vB = uv - vec2(0.0, uTexel.y);
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}`;

const PUSH_FRAGMENT = `precision highp float;

varying vec2 vUv;

uniform sampler2D uField;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform vec2 uPush;
uniform float uRadius;
uniform float uAspect;

void main() {
  vec2 a = uFrom * vec2(uAspect, 1.0);
  vec2 b = uTo * vec2(uAspect, 1.0);
  vec2 p = vUv * vec2(uAspect, 1.0);
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  vec2 d = p - (a + ab * h);
  float g = exp(-dot(d, d) / max(uRadius * uRadius, 1e-6));
  vec2 field = texture2D(uField, vUv).xy + uPush * g;
  float size = length(field);
  field *= min(1.0, 0.24 / max(size, 1e-5));
  gl_FragColor = vec4(field, 0.0, 1.0);
}`;

const SETTLE_FRAGMENT = `precision highp float;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

uniform sampler2D uField;
uniform float uKeep;

void main() {
  vec2 center = texture2D(uField, vUv).xy;
  vec2 around = (
    texture2D(uField, vL).xy +
    texture2D(uField, vR).xy +
    texture2D(uField, vT).xy +
    texture2D(uField, vB).xy
  ) * 0.25;
  gl_FragColor = vec4(mix(center, around, 0.4) * uKeep, 0.0, 1.0);
}`;

const DISPLAY_VERTEX = `varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}`;

const CLOUD_FRAGMENT = `precision highp float;

#define PI 3.14159265359
#define TAU 6.28318530718

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFlow;
uniform float uWind;
uniform vec3 uSky;
uniform vec3 uLight;
uniform vec3 uShade;
uniform float uTransparent;
uniform float uTop;
uniform float uCeiling;
uniform float uFadeStart;
uniform float uCoverage;
uniform float uDensity;
uniform float uScale;
uniform float uRise;
uniform float uDip;
uniform float uOpacity;
uniform float uSeed;
uniform sampler2D uWake;
uniform float uWakeStrength;

const mat2 SPIN_A = mat2(0.80, 0.60, -0.60, 0.80);
const mat2 SPIN_B = mat2(1.60, 1.20, -1.20, 1.60);

vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy) * 2.0 - 1.0;
}

mat2 rotation(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}

float cellular(vec2 x, float phase) {
  vec2 cell = floor(x);
  vec2 f = fract(x);
  float inverse = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 site = 0.5 + 0.5 * sin(phase + TAU * hash22(cell + g));
      vec2 r = g + site - f;
      float d2 = dot(r, r);
      float d4 = d2 * d2;
      float d8 = d4 * d4;
      inverse += 1.0 / (d8 * d8);
    }
  }
  return 1.0 - pow(inverse, -0.125);
}

float lobe(vec2 cell, vec2 offset, vec2 f, mat2 turn) {
  float sgn = 1.0 - 2.0 * mod(offset.x + offset.y, 2.0);
  return sgn * dot(hash22(cell + offset), turn * (f - offset));
}

float curl(vec2 p, float angle) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  mat2 turn = rotation(angle + PI * (1.0 - mod(cell.x + cell.y, 2.0)));
  float n = mix(
    mix(lobe(cell, vec2(0.0, 0.0), f, turn), lobe(cell, vec2(1.0, 0.0), f, turn), w.x),
    mix(lobe(cell, vec2(0.0, 1.0), f, turn), lobe(cell, vec2(1.0, 1.0), f, turn), w.x),
    w.y
  );
  return 0.5 + n;
}

float puffs(vec2 p, float t) {
  float sum = 0.5 * cellular(p, t * 0.1);
  p = SPIN_A * p * 2.02;
  sum += 0.25 * cellular(p, t * 0.2);
  p = SPIN_A * p * 2.03;
  sum += 0.125 * cellular(p, t * 0.5);
  return (sum + 0.0625) / 0.9375;
}

float billows(vec2 p, float t) {
  float sum = 0.5 * curl(p, t * 0.1);
  p = SPIN_B * p;
  sum += 0.25 * curl(p, t * 0.4);
  p = SPIN_B * p;
  sum += 0.125 * curl(p, t * 0.7);
  p = SPIN_B * p;
  sum += 0.0625 * curl(p, t * 0.3);
  p = SPIN_B * p;
  sum += 0.0325 * curl(p, t * 0.3);
  return sum * 1.2;
}

float swirl(vec2 p, float t) {
  float sum = 0.5 * curl(p, t * 0.1);
  p = SPIN_B * p;
  sum += 0.25 * curl(p, t * 0.4);
  return sum * 1.2;
}

void main() {
  vec2 px = vUv * uResolution;
  vec2 wake = texture2D(uWake, vUv).xy * uWakeStrength;
  px -= wake * uResolution.y;
  if (uTop > 0.5) px.y = uResolution.y - px.y;
  float h = px.y / uResolution.y;
  float t = uTime;
  float unit = max(uResolution.x, uResolution.y);

  float sx = (px.x + uWind * unit / uScale) / uResolution.y + uSeed * 3.1;
  float ridge = curl(vec2(sx * 0.6 + t * 0.01, 4.7), 0.0);
  ridge = 0.7 * ridge + 0.3 * curl(vec2(sx * 1.5 - t * 0.006, 8.3), 0.0);
  ridge = 0.5 + (ridge - 0.5) * 2.0;
  float tower = smoothstep(0.4, 0.85, ridge);
  float lift = mix(-uDip, uRise, tower);

  vec3 cloud = uLight;
  float amount = 0.0;
  if (h <= uCeiling + lift) {
    float churn = uFlow * 0.5;
    float drift = t * 0.15;
    vec2 uv = vec2(px.x, -px.y) / unit;
    uv += swirl(uv * uScale + vec2(0.0, churn * 0.5), churn) * 0.025;
    vec2 q = uv * uScale + vec2(uWind + uSeed * 17.3, drift + uSeed * 9.1);
    float shape = puffs(q, churn * 10.0);
    float detail = billows(q, churn * 10.0);

    float band = uCoverage * clamp(1.0 - h + lift * 0.9, 0.0, 1.0);
    shape = smoothstep(0.0, 1.0, shape) * band + uDensity;
    detail = smoothstep(0.0, 1.0, detail) * band + uDensity;
    float density = shape * detail;
    density *= smoothstep(0.0, 1.0, density);

    cloud = mix(uLight, uShade, smoothstep(0.5, 0.99, density));
    float cover = smoothstep(0.2, 0.5, density);
    float fade = 1.0 - smoothstep(uFadeStart + lift, uCeiling + lift, h);
    float part = clamp(length(wake) * 2.6, 0.0, 0.5);
    amount = cover * fade * uOpacity * (1.0 - part);
  }

  if (uTransparent > 0.5) {
    gl_FragColor = vec4(cloud * amount, amount);
  } else {
    gl_FragColor = vec4(mix(uSky, cloud, amount), 1.0);
  }
}`;

const DEFAULT_COLORS = ['#6D5BC0', '#3A2E7A'];

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

const isTransparent = (colorStr) => {
  if (!colorStr) return false;
  const t = colorStr.trim().toLowerCase();
  return (
    t === 'transparent' ||
    (/^#[0-9a-f]{8}$/.test(t) ? t.endsWith('00') : false) ||
    (/^#[0-9a-f]{4}$/.test(t) ? t.endsWith('0') : false) ||
    null !== t.match(/^(?:rgba?|hsla?)\(.*[,/]\s*(0|0?\.0+|0%)\s*\)$/)
  );
};

const tempColor = new THREE.Color();
const toVec3 = (targetVec3, colorStr, fallback) => {
  const str = (colorStr || fallback).trim();
  try {
    tempColor.set(/^#[0-9a-f]{8}$/i.test(str) ? str.slice(0, 7) : str);
  } catch {
    tempColor.set(fallback);
  }
  targetVec3.set(tempColor.r, tempColor.g, tempColor.b);
};

export const CLOUD_ATLAS_PRESETS = {
  dusk: {
    colors: ['#6D5BC0', '#3A2E7A'],
    background: '#000000',
    opacity: 0.7,
    height: 0.9,
    coverage: 0.45,
    towers: 1,
  },
  night: {
    colors: ['#262B36', '#181C24'],
    background: '#000000',
    opacity: 0.65,
    height: 0.9,
    coverage: 0.45,
    towers: 1,
  },
  obsidian: {
    colors: ['#3b82f6', '#1e1b4b'],
    background: '#000000',
    opacity: 0.8,
    height: 0.85,
    coverage: 0.5,
    towers: 1.2,
  },
  daylight: {
    colors: ['#FFFFFF', '#E7F1FB'],
    background: '#A7EFFE',
    opacity: 0.9,
    height: 0.9,
    coverage: 0.45,
    towers: 1,
  },
  storm: {
    colors: ['#8A93A1', '#5F6876'],
    background: '#050505',
    opacity: 0.75,
    height: 1.1,
    coverage: 0.6,
    towers: 1.4,
  },
};

export default function CloudAtlas({
  colors = DEFAULT_COLORS,
  backgroundColor = '#000000',
  anchor = 'bottom',
  height = 0.9,
  coverage = 0.45,
  density = 0.55,
  scale = 1,
  towers = 1,
  opacity = 0.7,
  wind = 0,
  billow = 1,
  speed = 1,
  resolution = 0.36,
  interactive = true,
  cursorStrength = 1,
  cursorRadius = 0.16,
  seed = 0,
  paused = false,
  className = '',
  style = {},
  children,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, inside: false, moved: 0 });
  const stateRef = useRef({
    time: 12,
    flow: 12,
    drift: 0,
    lastX: 0.5,
    lastY: 0.5,
    hasLast: false,
    lastMoved: 0,
    energy: 0,
    lastNow: 0,
  });

  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '80px' }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!interactive) return;

    const onPointerMove = (e) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const p = pointerRef.current;
      p.x = (e.clientX - rect.left) / Math.max(rect.width, 1);
      p.y = 1 - (e.clientY - rect.top) / Math.max(rect.height, 1);
      p.inside = true;
      p.moved += 1;
    };

    const onPointerLeave = (e) => {
      if (e.type !== 'pointerup' || e.pointerType !== 'mouse') {
        pointerRef.current.inside = false;
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('pointerup', onPointerLeave, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerup', onPointerLeave);
    };
  }, [interactive]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });

    const getDimensions = () => {
      const rect = container.getBoundingClientRect();
      return {
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      };
    };

    let dims = getDimensions();
    const dpr = clamp(resolution, 0.1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(dims.width, dims.height, false);

    const aspect = dims.width / Math.max(dims.height, 1);
    const simWidth = Math.max(16, Math.round(72 * aspect));
    const simHeight = 72;

    const createRT = (w, h) =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      });

    let fieldRead = createRT(simWidth, simHeight);
    let fieldWrite = createRT(simWidth, simHeight);

    const simScene = new THREE.Scene();
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const texel = new THREE.Vector2(1 / simWidth, 1 / simHeight);

    const pushMat = new THREE.ShaderMaterial({
      vertexShader: SIM_VERTEX,
      fragmentShader: PUSH_FRAGMENT,
      uniforms: {
        uTexel: { value: texel },
        uField: { value: null },
        uFrom: { value: new THREE.Vector2() },
        uTo: { value: new THREE.Vector2() },
        uPush: { value: new THREE.Vector2() },
        uRadius: { value: 0.1 },
        uAspect: { value: aspect },
      },
      depthTest: false,
      depthWrite: false,
    });

    const settleMat = new THREE.ShaderMaterial({
      vertexShader: SIM_VERTEX,
      fragmentShader: SETTLE_FRAGMENT,
      uniforms: {
        uTexel: { value: texel },
        uField: { value: null },
        uKeep: { value: 0.98 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const simQuad = new THREE.Mesh(quadGeo, pushMat);
    simScene.add(simQuad);

    // Display Scene
    const displayScene = new THREE.Scene();
    const displayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const displayUniforms = {
      uResolution: { value: new THREE.Vector2(dims.width * dpr, dims.height * dpr) },
      uTime: { value: 12 },
      uFlow: { value: 12 },
      uWind: { value: 0 },
      uSky: { value: new THREE.Vector3() },
      uLight: { value: new THREE.Vector3() },
      uShade: { value: new THREE.Vector3() },
      uTransparent: { value: 0 },
      uTop: { value: 0 },
      uCeiling: { value: 0.9 },
      uFadeStart: { value: 0.5 },
      uCoverage: { value: 0.45 },
      uDensity: { value: 0.55 },
      uScale: { value: 8 },
      uRise: { value: 0.5 },
      uDip: { value: 0.1 },
      uOpacity: { value: 0.9 },
      uSeed: { value: 0 },
      uWake: { value: null },
      uWakeStrength: { value: 1 },
    };

    const displayMat = new THREE.ShaderMaterial({
      vertexShader: DISPLAY_VERTEX,
      fragmentShader: CLOUD_FRAGMENT,
      uniforms: displayUniforms,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      premultipliedAlpha: true,
    });

    const displayQuad = new THREE.Mesh(quadGeo, displayMat);
    displayScene.add(displayQuad);

    const updateColors = () => {
      const [colLight, colShade] = colors;
      toVec3(displayUniforms.uLight.value, colLight ?? DEFAULT_COLORS[0], DEFAULT_COLORS[0]);
      toVec3(displayUniforms.uShade.value, colShade ?? colLight ?? DEFAULT_COLORS[1], DEFAULT_COLORS[1]);
      const transparent = isTransparent(backgroundColor);
      toVec3(displayUniforms.uSky.value, transparent ? '#000000' : backgroundColor, '#000000');
      displayUniforms.uTransparent.value = transparent ? 1 : 0;
    };
    updateColors();

    let animationId = 0;
    let isDisposed = false;

    const onResize = () => {
      dims = getDimensions();
      renderer.setSize(dims.width, dims.height, false);
      const newAspect = dims.width / Math.max(dims.height, 1);
      displayUniforms.uResolution.value.set(dims.width * dpr, dims.height * dpr);
      pushMat.uniforms.uAspect.value = newAspect;
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    const animate = (now) => {
      if (isDisposed) return;
      animationId = requestAnimationFrame(animate);

      if (!isVisible && !interactive) return;

      const v = stateRef.current;
      const f = pointerRef.current;
      const dt = v.lastNow ? Math.min(Math.max((now - v.lastNow) / 1000, 0), 0.05) : 1 / 60;
      v.lastNow = now;

      const running = !paused && speed > 0;
      const step = running ? dt * clamp(speed, 0, 4) : 0;
      v.time += step;
      v.flow += step * clamp(billow, 0, 4);
      v.drift += step * clamp(wind, -4, 4) * 0.12;

      const currentAspect = dims.width / Math.max(dims.height, 1);
      const executePass = (mat) => {
        simQuad.material = mat;
        renderer.setRenderTarget(fieldWrite);
        renderer.render(simScene, simCamera);
        const temp = fieldRead;
        fieldRead = fieldWrite;
        fieldWrite = temp;
      };

      if (interactive && f.inside && f.moved !== v.lastMoved) {
        v.lastMoved = f.moved;
        if (!v.hasLast) {
          v.lastX = f.x;
          v.lastY = f.y;
          v.hasLast = true;
        }
        const dx = f.x - v.lastX;
        const dy = f.y - v.lastY;
        if (Math.hypot(dx * currentAspect, dy) > 5e-4) {
          const pu = pushMat.uniforms;
          const strength = 1.3 * clamp(cursorStrength, 0, 3);
          pu.uField.value = fieldRead.texture;
          pu.uAspect.value = currentAspect;
          pu.uRadius.value = clamp(cursorRadius, 0.02, 1);
          pu.uFrom.value.set(v.lastX, v.lastY);
          pu.uTo.value.set(f.x, f.y);
          pu.uPush.value.set(
            clamp(dx * currentAspect, -0.2, 0.2) * strength,
            clamp(dy, -0.2, 0.2) * strength
          );
          executePass(pushMat);
          v.energy = 1;
        }
        v.lastX = f.x;
        v.lastY = f.y;
      }

      if (!f.inside) {
        v.hasLast = false;
      }

      if (v.energy > 0.002) {
        settleMat.uniforms.uField.value = fieldRead.texture;
        settleMat.uniforms.uKeep.value = Math.exp(-dt / 0.9);
        executePass(settleMat);
        v.energy *= Math.exp(-dt / 0.9);
      }

      // Display pass
      renderer.setRenderTarget(null);
      displayUniforms.uWake.value = fieldRead.texture;
      displayUniforms.uTime.value = v.time;
      displayUniforms.uFlow.value = v.flow;
      displayUniforms.uWind.value = v.drift;
      displayUniforms.uTop.value = anchor === 'top' ? 1 : 0;

      const ceil = clamp(height, 0.05, 1.5);
      displayUniforms.uCeiling.value = ceil;
      displayUniforms.uFadeStart.value = 0.555 * ceil;
      displayUniforms.uCoverage.value = clamp(coverage, 0, 2);
      displayUniforms.uDensity.value = clamp(density, 0, 1.5);
      displayUniforms.uScale.value = 8 / clamp(scale, 0.2, 5);
      displayUniforms.uRise.value = 0.5 * clamp(towers, 0, 3);
      displayUniforms.uDip.value = 0.1 * clamp(towers, 0, 3);
      displayUniforms.uOpacity.value = clamp(opacity, 0, 1);
      displayUniforms.uSeed.value = seed;
      displayUniforms.uWakeStrength.value = interactive ? 1 : 0;

      renderer.render(displayScene, displayCamera);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      fieldRead.dispose();
      fieldWrite.dispose();
      pushMat.dispose();
      settleMat.dispose();
      displayMat.dispose();
      quadGeo.dispose();
      renderer.dispose();
    };
  }, [
    colors,
    backgroundColor,
    anchor,
    height,
    coverage,
    density,
    scale,
    towers,
    opacity,
    wind,
    billow,
    speed,
    resolution,
    interactive,
    cursorStrength,
    cursorRadius,
    seed,
    paused,
    isVisible,
  ]);

  const transparent = isTransparent(backgroundColor);

  return (
    <div
      ref={containerRef}
      className={`relative isolate overflow-hidden ${className}`}
      style={{
        backgroundColor: transparent ? undefined : backgroundColor,
        ...style,
      }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
      {children ? <div className="relative z-10 h-full w-full">{children}</div> : null}
    </div>
  );
}
