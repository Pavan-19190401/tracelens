'use client';

import React, { useEffect, useRef, useState } from 'react';
import './BlackHole.css';

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uZoom;
uniform float uSpeed;
uniform int uParticleCount;
uniform float uOrbSize;
uniform float uGlow;
uniform float uContrast;
uniform float uMirrorSplits;
uniform float uDistanceFade;
uniform float uRingIntensity;
uniform float uBloom;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uCursorIntensity;
uniform float uGulp;

// Color cycle or gradient
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform int uUseCustomColors;
uniform float uColorSpeed;

// Perlin / Simplex pseudo-noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
  
  // Mouse warp interaction
  vec2 mouseOffset = (uMouse - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
  float distToMouse = length(uv - mouseOffset);
  uv += (mouseOffset - uv) * (0.08 * uCursorIntensity / (distToMouse + 0.35));

  // Gulp contraction pulse
  uv *= (1.0 + uGulp * 0.45);

  float r = length(uv) * uZoom;
  float angle = atan(uv.y, uv.x);

  // Symmetry folds (mirrorSplits)
  if (uMirrorSplits > 1.0) {
    float seg = 6.2831853 / uMirrorSplits;
    angle = abs(mod(angle + seg * 0.5, seg) - seg * 0.5);
  }

  // Event horizon and photon ring
  float eventHorizon = 0.28;
  float photonRingRadius = 0.38;

  // Gravitational lensing warp: deflection pulls light inwards near center
  float deflection = 0.18 / (r * r + 0.08);
  float warpedAngle = angle + uTime * uSpeed * 0.4 + deflection;
  vec2 warpedUv = vec2(cos(warpedAngle), sin(warpedAngle)) * r;

  // Accretion disk & particle orbital trail calculations
  float diskLight = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= uParticleCount) break;
    float fi = float(i);
    float orbitRadius = uOrbSize * (0.6 + 0.5 * fract(fi * 0.2831));
    float orbitSpeed = (1.2 + 0.8 * fract(fi * 0.7182)) * (fi > 12.0 ? -0.7 : 1.0);
    float particleAngle = uTime * uSpeed * orbitSpeed + fi * 1.618;
    
    vec2 particlePos = vec2(cos(particleAngle), sin(particleAngle)) * orbitRadius;
    float d = length(warpedUv - particlePos);
    
    // Light glow accumulation
    diskLight += (uGlow / (d * d * 35.0 + 0.04));
  }

  // Smoky swirl texture inside accretion vortex
  float smoke = noise(vec2(r * 8.0 - uTime * uSpeed * 0.6, angle * 3.0 + deflection * 2.0));
  float smoke2 = noise(vec2(r * 14.0 + uTime * uSpeed * 0.3, angle * 5.0 - deflection));
  float combinedSmoke = (smoke * 0.6 + smoke2 * 0.4);
  diskLight *= (0.6 + 0.7 * combinedSmoke);

  // Accretion disc radial falloff
  float discFalloff = smoothstep(eventHorizon * 0.9, photonRingRadius, r) * 
                      smoothstep(uZoom * 1.2, photonRingRadius * 1.1, r);
  diskLight *= discFalloff;

  // Photon ring: brilliant, crisp glowing boundary at event horizon edge
  float ringDist = abs(r - photonRingRadius);
  float photonRing = (0.015 * uRingIntensity) / (ringDist * ringDist * 160.0 + 0.003);
  
  // Relativistic beaming / Doppler effect (brighter on one side)
  float doppler = 1.0 + 0.65 * sin(angle);
  photonRing *= doppler;
  diskLight *= doppler;

  // Event horizon shadow (absolute black center)
  float coreShadow = smoothstep(eventHorizon * 0.92, eventHorizon * 1.08, r);

  // Total energy
  float energy = (diskLight + photonRing) * coreShadow;
  energy = pow(max(energy, 0.0), uContrast * 0.45);
  energy *= (1.0 + uBloom * 0.5);

  // Color mapping
  vec3 color;
  if (uUseCustomColors == 1) {
    color = mix(uColorA, uColorB, clamp(r / (uZoom * 0.8), 0.0, 1.0)) * energy;
  } else {
    // Dynamic spectral cycling: cosmic cyan, deep violet, stellar gold
    float t = uTime * uColorSpeed;
    vec3 c1 = vec3(0.25, 0.65, 1.0); // Cyan/blue
    vec3 c2 = vec3(0.75, 0.35, 1.0); // Purple/violet
    vec3 c3 = vec3(1.0, 0.62, 0.22); // Amber photon ring
    
    vec3 spectral = mix(c1, c2, 0.5 + 0.5 * sin(t + warpedAngle));
    color = mix(spectral, c3, clamp(photonRing * 0.8, 0.0, 1.0)) * energy;
  }

  // Distance fade to preserve readability of UI
  float edgeFade = smoothstep(0.0, uDistanceFade * 1.5, length(uv));
  color *= edgeFade;

  // Output with alpha
  float alpha = clamp(length(color) * 1.2, 0.0, 1.0) * uOpacity;
  fragColor = vec4(color, alpha);
}
`;

const parseColor = (hex, fallback = [1, 1, 1]) => {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) / 255,
      parseInt(clean[1] + clean[1], 16) / 255,
      parseInt(clean[2] + clean[2], 16) / 255
    ];
  }
  if (clean.length >= 6) {
    return [
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255
    ];
  }
  return fallback;
};

export default function BlackHole({
  width = '100%',
  height = '100%',
  speed = 1,
  zoom = 1.8,
  particleCount = 14,
  orbSize = 0.75,
  glow = 0.08,
  contrast = 3,
  mirrorSplits = 2,
  warpEnabled = true,
  distanceFade = 0.35,
  colorSpeed = 0.2,
  colors,
  backgroundColor = 'transparent',
  opacity = 1,
  bloom = 1.2,
  ringIntensity = 1.4,
  cursorInteraction = true,
  cursorIntensity = 1,
  intro = true,
  paused = false,
  dpr = 2,
  children,
  className = '',
  style
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const gulpRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    if (!gl) return;

    // Compile shaders
    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, VERTEX_SHADER);
    gl.compileShader(vert);

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, FRAGMENT_SHADER);
    gl.compileShader(frag);

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteProgram(program);
      return;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uZoom = gl.getUniformLocation(program, 'uZoom');
    const uSpeed = gl.getUniformLocation(program, 'uSpeed');
    const uParticleCount = gl.getUniformLocation(program, 'uParticleCount');
    const uOrbSize = gl.getUniformLocation(program, 'uOrbSize');
    const uGlow = gl.getUniformLocation(program, 'uGlow');
    const uContrast = gl.getUniformLocation(program, 'uContrast');
    const uMirrorSplits = gl.getUniformLocation(program, 'uMirrorSplits');
    const uDistanceFade = gl.getUniformLocation(program, 'uDistanceFade');
    const uRingIntensity = gl.getUniformLocation(program, 'uRingIntensity');
    const uBloom = gl.getUniformLocation(program, 'uBloom');
    const uOpacity = gl.getUniformLocation(program, 'uOpacity');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const uCursorIntensity = gl.getUniformLocation(program, 'uCursorIntensity');
    const uGulp = gl.getUniformLocation(program, 'uGulp');
    const uColorA = gl.getUniformLocation(program, 'uColorA');
    const uColorB = gl.getUniformLocation(program, 'uColorB');
    const uUseCustomColors = gl.getUniformLocation(program, 'uUseCustomColors');
    const uColorSpeed = gl.getUniformLocation(program, 'uColorSpeed');

    let rafId;
    let startTime = performance.now();
    let currentDpr = Math.min(window.devicePixelRatio || 1, dpr);

    const resize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const w = Math.max(rect.width, 1);
      const h = Math.max(rect.height, 1);
      currentDpr = Math.min(window.devicePixelRatio || 1, dpr);
      canvas.width = Math.round(w * currentDpr);
      canvas.height = Math.round(h * currentDpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const handlePointerMove = e => {
      if (!cursorInteraction) return;
      const rect = container.getBoundingClientRect();
      mouseRef.current.targetX = (e.clientX - rect.left) * currentDpr;
      mouseRef.current.targetY = (rect.height - (e.clientY - rect.top)) * currentDpr;
    };

    const handleClick = () => {
      if (!cursorInteraction) return;
      gulpRef.current = 1.0;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    container.addEventListener('pointerdown', handleClick, { passive: true });

    let running = true;
    const render = now => {
      if (!running) return;
      if (!paused) {
        const elapsed = (now - startTime) / 1000;

        // Smooth mouse
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

        // Gulp decay
        gulpRef.current *= 0.92;

        gl.useProgram(program);
        gl.bindVertexArray(vao);

        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, elapsed);
        gl.uniform1f(uZoom, zoom);
        gl.uniform1f(uSpeed, speed);
        gl.uniform1i(uParticleCount, Math.min(Math.max(particleCount, 1), 24));
        gl.uniform1f(uOrbSize, orbSize);
        gl.uniform1f(uGlow, glow);
        gl.uniform1f(uContrast, contrast);
        gl.uniform1f(uMirrorSplits, warpEnabled ? mirrorSplits : 0.0);
        gl.uniform1f(uDistanceFade, distanceFade);
        gl.uniform1f(uRingIntensity, ringIntensity);
        gl.uniform1f(uBloom, bloom);
        gl.uniform1f(uOpacity, opacity);
        gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
        gl.uniform1f(uCursorIntensity, cursorInteraction ? cursorIntensity : 0.0);
        gl.uniform1f(uGulp, gulpRef.current);
        gl.uniform1f(uColorSpeed, colorSpeed);

        if (Array.isArray(colors) && colors.length >= 2) {
          gl.uniform1i(uUseCustomColors, 1);
          gl.uniform3fv(uColorA, parseColor(colors[0], [0.3, 0.7, 1.0]));
          gl.uniform3fv(uColorB, parseColor(colors[1], [0.9, 0.4, 0.9]));
        } else {
          gl.uniform1i(uUseCustomColors, 0);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerdown', handleClick);
      gl.deleteBuffer(posBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteProgram(program);
    };
  }, [
    speed,
    zoom,
    particleCount,
    orbSize,
    glow,
    contrast,
    mirrorSplits,
    warpEnabled,
    distanceFade,
    colorSpeed,
    colors,
    opacity,
    bloom,
    ringIntensity,
    cursorInteraction,
    cursorIntensity,
    paused,
    dpr
  ]);

  return (
    <div
      ref={containerRef}
      className={`black-hole-container ${className}`.trim()}
      style={{
        position: 'relative',
        width,
        height,
        backgroundColor,
        overflow: 'hidden',
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        className="black-hole-canvas"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none'
        }}
      />
      {children && <div className="black-hole-content" style={{ position: 'relative', zIndex: 10 }}>{children}</div>}
    </div>
  );
}
