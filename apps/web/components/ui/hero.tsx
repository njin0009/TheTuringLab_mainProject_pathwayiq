"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { cn } from "@/lib/utils";

interface HeroProps {
  trustBadge?: {
    text: string;
    icons?: string[];
  };
  headline: {
    line1: string;
    line2: string;
  };
  subtitle: string;
  actionSlot?: ReactNode;
  refreshToken?: number;
  className?: string;
}

type ThreeBundle = {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  composer: EffectComposer | null;
  stars: THREE.Points[];
  starMaterials: THREE.ShaderMaterial[];
  nebula: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
  mountains: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>[];
  atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null;
  animationId: number | null;
  targetCameraX: number;
  targetCameraY: number;
  targetCameraZ: number;
};

const splitChars = (text: string) =>
  text.split("").map((char, index) => (
    <span key={`${char}-${index}`} className="title-char inline-block">
      {char === " " ? "\u00A0" : char}
    </span>
  ));

const splitWordsToChars = (text: string) =>
  text.split(" ").map((word, wordIndex, words) => (
    <span
      key={`${word}-${wordIndex}`}
      className={cn(
        "inline-block whitespace-nowrap",
        wordIndex < words.length - 1 ? "mr-[0.18em]" : "",
      )}
    >
      {word.split("").map((char, charIndex) => (
        <span key={`${word}-${wordIndex}-${charIndex}`} className="title-char inline-block">
          {char}
        </span>
      ))}
    </span>
  ));

export default function ShaderShowcase({
  trustBadge,
  headline,
  subtitle,
  actionSlot,
  refreshToken = 0,
  className,
}: HeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleTopRef = useRef<HTMLHeadingElement>(null);
  const titleBottomRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const smoothCameraPos = useRef({ x: 0, y: 28, z: 240 });
  const threeRefs = useRef<ThreeBundle>({
    scene: null,
    camera: null,
    renderer: null,
    composer: null,
    stars: [],
    starMaterials: [],
    nebula: null,
    mountains: [],
    atmosphere: null,
    animationId: null,
    targetCameraX: 0,
    targetCameraY: 28,
    targetCameraZ: 240,
  });
  const [isReady, setIsReady] = useState(false);

  const footerLabel = useMemo(() => "HOME / 01", []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const refs = threeRefs.current;
    let isDisposed = false;
    let readyFrame = 0;

    refs.scene = new THREE.Scene();
    refs.scene.fog = new THREE.FogExp2(0x02040a, 0.00023);

    refs.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.1,
      3000,
    );
    refs.camera.position.set(0, 28, 240);

    refs.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    refs.renderer.setSize(window.innerWidth, window.innerHeight);
    refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    refs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    refs.renderer.toneMappingExposure = 0.68;

    refs.composer = new EffectComposer(refs.renderer);
    refs.composer.addPass(new RenderPass(refs.scene, refs.camera));
      refs.composer.addPass(
        new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.34,
          0.24,
          0.96,
        ),
      );

    const createStarField = () => {
      const scene = refs.scene;
      if (!scene) {
        return;
      }

      const starCount = 2200;

      for (let layer = 0; layer < 3; layer += 1) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let i = 0; i < starCount; i += 1) {
          const radius = 260 + Math.random() * 1100;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);

          positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
          positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          positions[i * 3 + 2] = radius * Math.cos(phi);

          const color = new THREE.Color();
          const colorChoice = Math.random();
          if (colorChoice < 0.64) {
            color.setHSL(0.57, 0.42, 0.9);
          } else if (colorChoice < 0.88) {
            color.setHSL(0.12, 0.7, 0.8);
          } else {
            color.setHSL(0.16, 0.55, 0.88);
          }

          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
          sizes[i] = Math.random() * 1.8 + 0.45;
        }

        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            depth: { value: layer },
          },
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            uniform float depth;

            void main() {
              vColor = color;
              vec3 pos = position;
              float angle = time * 0.012 * (1.0 - depth * 0.22);
              mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
              pos.xy = rot * pos.xy;

              vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
              gl_PointSize = size * (320.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            varying vec3 vColor;

            void main() {
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;

              float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
              gl_FragColor = vec4(vColor, opacity);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const stars = new THREE.Points(geometry, material);
        scene.add(stars);
        refs.stars.push(stars);
        refs.starMaterials.push(material);
      }
    };

    const createNebula = () => {
      const scene = refs.scene;
      if (!scene) {
        return;
      }

      const geometry = new THREE.PlaneGeometry(6400, 3200, 72, 72);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color1: { value: new THREE.Color(0x4da8ff) },
          color2: { value: new THREE.Color(0xf4c65f) },
          color3: { value: new THREE.Color(0xfff2b3) },
          opacity: { value: 0.22 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vElevation;
          uniform float time;

          void main() {
            vUv = uv;
            vec3 pos = position;
            float elevation = sin(pos.x * 0.006 + time * 0.16) * cos(pos.y * 0.007 + time * 0.12) * 20.0;
            pos.z += elevation;
            vElevation = elevation;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color1;
          uniform vec3 color2;
          uniform vec3 color3;
          uniform float opacity;
          uniform float time;
          varying vec2 vUv;
          varying float vElevation;

          void main() {
            float wave = sin(vUv.x * 10.0 + time * 0.08) * cos(vUv.y * 8.0 + time * 0.06);
            vec3 mixed = mix(color1, color2, wave * 0.5 + 0.5);
            mixed = mix(mixed, color3, smoothstep(0.35, 1.0, vUv.y));

            float alpha = opacity * (1.0 - length(vUv - 0.5) * 1.65);
            alpha *= 1.0 + vElevation * 0.005;

            gl_FragColor = vec4(mixed, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const nebula = new THREE.Mesh(geometry, material);
      nebula.position.set(0, 40, -980);
      scene.add(nebula);
      refs.nebula = nebula;
    };

    const createMountains = () => {
      const scene = refs.scene;
      if (!scene) {
        return;
      }

      const layers = [
        { distance: -80, height: 90, color: 0x070d18, opacity: 0.98, offset: -120 },
        { distance: -180, height: 118, color: 0x0a1322, opacity: 0.84, offset: -150 },
        { distance: -280, height: 140, color: 0x102238, opacity: 0.66, offset: -170 },
        { distance: -360, height: 168, color: 0x17314b, opacity: 0.48, offset: -210 },
      ];

      layers.forEach((layer, index) => {
        const points: THREE.Vector2[] = [];
        const segments = 56;

        for (let i = 0; i <= segments; i += 1) {
          const x = (i / segments - 0.5) * 1800;
          const y =
            Math.sin(i * 0.18) * layer.height +
            Math.sin(i * 0.07) * layer.height * 0.55 +
            (Math.random() - 0.5) * layer.height * 0.22 +
            layer.offset;
          points.push(new THREE.Vector2(x, y));
        }

        points.push(new THREE.Vector2(2000, -420));
        points.push(new THREE.Vector2(-2000, -420));

        const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
        const material = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          side: THREE.DoubleSide,
        });

        const mountain = new THREE.Mesh(geometry, material);
        mountain.position.set(0, 96 - index * 18, layer.distance);
        mountain.userData = {
          baseZ: layer.distance,
          baseY: mountain.position.y,
          driftX: index * 2.4 + 1.8,
        };
        scene.add(mountain);
        refs.mountains.push(mountain);
      });
    };

    const createAtmosphere = () => {
      const scene = refs.scene;
      if (!scene) {
        return;
      }

      const geometry = new THREE.SphereGeometry(720, 32, 32);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          uniform float time;

          void main() {
            float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            vec3 atmosphere = vec3(0.45, 0.68, 1.0) * intensity;
            float pulse = sin(time * 0.16) * 0.015 + 0.955;
            gl_FragColor = vec4(atmosphere * pulse, intensity * 0.22);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      const atmosphere = new THREE.Mesh(geometry, material);
      scene.add(atmosphere);
      refs.atmosphere = atmosphere;
    };

    const animate = () => {
      if (isDisposed) {
        return;
      }

      refs.animationId = window.requestAnimationFrame(animate);
      const time = performance.now() * 0.001;

      refs.starMaterials.forEach((material) => {
        material.uniforms.time.value = time;
      });

      if (refs.nebula) {
        refs.nebula.material.uniforms.time.value = time;
      }

      if (refs.atmosphere) {
        refs.atmosphere.material.uniforms.time.value = time;
      }

      if (refs.camera) {
        const smoothingFactor = 0.035;
        smoothCameraPos.current.x +=
          (refs.targetCameraX - smoothCameraPos.current.x) * smoothingFactor;
        smoothCameraPos.current.y +=
          (refs.targetCameraY - smoothCameraPos.current.y) * smoothingFactor;
        smoothCameraPos.current.z +=
          (refs.targetCameraZ - smoothCameraPos.current.z) * smoothingFactor;

        refs.camera.position.x = smoothCameraPos.current.x + Math.sin(time * 0.11) * 2.2;
        refs.camera.position.y = smoothCameraPos.current.y + Math.cos(time * 0.16) * 1.6;
        refs.camera.position.z = smoothCameraPos.current.z;
        refs.camera.lookAt(0, 8, -680);
      }

      refs.mountains.forEach((mountain, index) => {
        const baseY = mountain.userData.baseY as number;
        const driftX = mountain.userData.driftX as number;
        mountain.position.x = Math.sin(time * 0.08 + index * 0.24) * driftX;
        mountain.position.y = baseY + Math.cos(time * 0.12 + index * 0.2) * 1.15;
      });

      refs.composer?.render();
    };

    const handleResize = () => {
      if (!refs.camera || !refs.renderer || !refs.composer) {
        return;
      }

      refs.camera.aspect = window.innerWidth / window.innerHeight;
      refs.camera.updateProjectionMatrix();
      refs.renderer.setSize(window.innerWidth, window.innerHeight);
      refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      refs.composer.setSize(window.innerWidth, window.innerHeight);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const normalizedX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = ((event.clientY - rect.top) / rect.height) * 2 - 1;

      refs.targetCameraX = normalizedX * 22;
      refs.targetCameraY = 28 + normalizedY * -10;
      refs.targetCameraZ = 240 + Math.abs(normalizedX) * -10;
    };

    createStarField();
    createNebula();
    createMountains();
    createAtmosphere();
    animate();
    readyFrame = window.requestAnimationFrame(() => {
      setIsReady(true);
    });

    window.addEventListener("resize", handleResize);
    container.addEventListener("pointermove", handlePointerMove);

    return () => {
      isDisposed = true;
      setIsReady(false);

      if (refs.animationId !== null) {
        window.cancelAnimationFrame(refs.animationId);
      }

      if (readyFrame !== 0) {
        window.cancelAnimationFrame(readyFrame);
      }

      window.removeEventListener("resize", handleResize);
      container.removeEventListener("pointermove", handlePointerMove);

      refs.stars.forEach((starField) => {
        starField.geometry.dispose();
      });
      refs.starMaterials.forEach((material) => material.dispose());

      refs.mountains.forEach((mountain) => {
        mountain.geometry.dispose();
        mountain.material.dispose();
      });

      if (refs.nebula) {
        refs.nebula.geometry.dispose();
        refs.nebula.material.dispose();
      }

      if (refs.atmosphere) {
        refs.atmosphere.geometry.dispose();
        refs.atmosphere.material.dispose();
      }

      refs.composer?.dispose();
      refs.renderer?.dispose();

      refs.stars = [];
      refs.starMaterials = [];
      refs.mountains = [];
      refs.nebula = null;
      refs.atmosphere = null;
      refs.composer = null;
      refs.renderer = null;
      refs.camera = null;
      refs.scene = null;
      refs.animationId = null;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (badgeRef.current) {
      timeline.fromTo(
        badgeRef.current,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        "-=0.2",
      );
    }

    const topChars = titleTopRef.current?.querySelectorAll(".title-char") ?? [];
    const bottomChars = titleBottomRef.current?.querySelectorAll(".title-char") ?? [];

    if (topChars.length > 0) {
      timeline.fromTo(
        topChars,
        { y: 110, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.25, stagger: 0.028, ease: "power4.out" },
        "-=0.35",
      );
    }

    if (bottomChars.length > 0) {
      timeline.fromTo(
        bottomChars,
        { y: 132, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.28, stagger: 0.022, ease: "power4.out" },
        "-=1.05",
      );
    }

    if (subtitleRef.current) {
      const subtitleLines = subtitleRef.current.querySelectorAll(".subtitle-line");
      timeline.fromTo(
        subtitleLines,
        { y: 36, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.78, stagger: 0.12 },
        "-=0.85",
      );
    }

    if (actionRef.current) {
      timeline.fromTo(
        actionRef.current,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.72 },
        "-=0.42",
      );
    }

    if (footerRef.current) {
      timeline.fromTo(
        footerRef.current,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        "-=0.4",
      );
    }

    return () => {
      timeline.kill();
    };
  }, [headline.line1, headline.line2, isReady, refreshToken]);

  useEffect(() => {
    if (!isReady || !glowRef.current) {
      return;
    }

    const glow = glowRef.current;
    const tween = gsap.fromTo(
      glow,
      { x: 0 },
      {
        x: 240,
        duration: 18,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      },
    );

    return () => {
      tween.kill();
    };
  }, [isReady, refreshToken]);

  return (
    <div
      ref={containerRef}
      className={cn("relative min-h-screen overflow-hidden bg-black", className)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(255,243,186,0.12),transparent_18%),radial-gradient(circle_at_62%_28%,rgba(126,201,255,0.12),transparent_26%),linear-gradient(180deg,rgba(127,176,235,0.24),rgba(90,133,202,0.14)_34%,rgba(9,21,46,0.6)_72%,rgba(4,9,22,0.9))]" />
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-1/2 top-[14%] z-10 h-[16rem] w-[16rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,248,203,0.92)_0%,rgba(255,221,129,0.5)_22%,rgba(255,191,87,0.18)_44%,rgba(255,191,87,0.04)_64%,transparent_78%)] opacity-80 blur-[58px] md:h-[22rem] md:w-[22rem] md:blur-[70px]"
      />

      <div className="relative z-20 flex min-h-screen items-end px-6 pb-40 pt-24 md:px-10 md:pb-44">
        <div className="max-w-4xl">
          {trustBadge ? (
            <div
              ref={badgeRef}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/22 px-4 py-2.5 text-sm font-medium tracking-wide text-white/88 backdrop-blur-sm"
              style={{ visibility: isReady ? "visible" : "hidden" }}
            >
              {trustBadge.icons?.map((icon, index) => (
                <span key={`${icon}-${index}`}>{icon}</span>
              ))}
              <span>{trustBadge.text}</span>
            </div>
          ) : null}

          <h1
            ref={titleTopRef}
            className="overflow-hidden text-4xl font-medium tracking-[0.02em] text-slate-50 drop-shadow-[0_14px_34px_rgba(0,0,0,0.36)] md:text-6xl lg:text-7xl"
          >
            {splitChars(headline.line1)}
          </h1>
          <h2
            ref={titleBottomRef}
            className="mt-2 overflow-hidden text-5xl font-black leading-[0.94] tracking-tight text-cyan-100 md:text-8xl lg:text-[9rem]"
          >
            {splitWordsToChars(headline.line2)}
          </h2>

          <div
            ref={subtitleRef}
            className="mt-6 max-w-2xl text-base leading-8 text-white/72 md:text-lg"
          >
            <p className="subtitle-line">
              Stand on the horizon between curiosity and direction.
            </p>
            <p className="subtitle-line">{subtitle}</p>
          </div>

          {actionSlot ? (
            <div ref={actionRef} className="mt-8 flex items-center gap-4">
              {actionSlot}
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={footerRef}
        className="pointer-events-none absolute bottom-8 right-6 z-20 hidden items-end gap-4 md:flex"
        style={{ visibility: isReady ? "visible" : "hidden" }}
      >
        <div className="text-right text-[11px] uppercase tracking-[0.38em] text-white/52">
          <div>HORIZON MODE</div>
          <div className="mt-2 text-white/78">{footerLabel}</div>
        </div>
        <div className="h-16 w-px bg-gradient-to-b from-cyan-300/0 via-cyan-300/50 to-cyan-300/0" />
      </div>
    </div>
  );
}
