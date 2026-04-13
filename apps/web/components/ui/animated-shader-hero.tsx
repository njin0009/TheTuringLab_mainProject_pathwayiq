"use client";
import React, { useRef, useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { Boxes } from "@/components/ui/background-boxes";

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
  buttons?: {
    primary?: { text: string; onClick?: () => void };
    secondary?: { text: string; onClick?: () => void };
  };
  className?: string;
}

interface ShaderProgram extends WebGLProgram {
  resolution: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  move: WebGLUniformLocation | null;
  touch: WebGLUniformLocation | null;
  pointerCount: WebGLUniformLocation | null;
  pointers: WebGLUniformLocation | null;
}

// ── SHADER SOURCE (orange / amber template palette) ───────────────────────
const defaultShaderSource = `#version 300 es
 /*********
 * made by Matthias Hurrle (@atzedent)
 */
 precision highp float;
 out vec4 O;
 uniform vec2 resolution;
 uniform float time;
 #define FC gl_FragCoord.xy
 #define T time
 #define R resolution
 #define MN min(R.x,R.y)
 float rnd(vec2 p) {
   p=fract(p*vec2(12.9898,78.233));
   p+=dot(p,p+34.56);
   return fract(p.x*p.y);
 }
 float noise(in vec2 p) {
   vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
   float a=rnd(i), b=rnd(i+vec2(1,0)), c=rnd(i+vec2(0,1)), d=rnd(i+1.);
   return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
 }
 float fbm(vec2 p) {
   float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);
   for (int i=0; i<5; i++) {
     t+=a*noise(p);
     p*=2.*m;
     a*=.5;
   }
   return t;
 }
 float clouds(vec2 p) {
   float d=1., t=.0;
   for (float i=.0; i<3.; i++) {
     float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
     t=mix(t,d,a);
     d=a;
     p*=2./(i+1.);
   }
   return t;
 }
 void main(void) {
   vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);
   vec3 col=vec3(0);
   float bg=clouds(vec2(st.x+T*.5,-st.y));
   uv*=1.-.3*(sin(T*.2)*.5+.5);
   for (float i=1.; i<12.; i++) {
     uv+=.1*cos(i*vec2(.1+.01*i, .8)+i*i+T*.5+.1*uv.x);
     vec2 p=uv;
     float d=length(p);
     col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);
     float b=noise(i+p+bg*1.731);
     col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
     col=mix(col,vec3(bg*.25,bg*.137,bg*.05),d);
   }
   O=vec4(col,1);
}`;

// ── WEBGL RENDERER ─────────────────────────────────────────────────────────
class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: ShaderProgram | null = null;
  private vs: WebGLShader | null = null;
  private fs: WebGLShader | null = null;
  private buffer: WebGLBuffer | null = null;
  private scale: number;
  private shaderSource: string;
  private mouseMove = [0, 0];
  private mouseCoords = [0, 0];
  private pointerCoords = [0, 0];
  private nbrOfPointers = 0;

  private vertexSrc = `#version 300 es
precision highp float;
in vec4 position;
void main(){ gl_Position = position; }`;

  private vertices = [-1, 1, -1, -1, 1, 1, 1, -1];

  constructor(canvas: HTMLCanvasElement, scale: number) {
    this.canvas = canvas;
    this.scale = scale;
    this.gl = canvas.getContext("webgl2")!;
    this.gl.viewport(0, 0, canvas.width * scale, canvas.height * scale);
    this.shaderSource = defaultShaderSource;
  }

  updateShader(source: string) { this.reset(); this.shaderSource = source; this.setup(); this.init(); }
  updateMove(d: number[]) { this.mouseMove = d; }
  updateMouse(c: number[]) { this.mouseCoords = c; }
  updatePointerCoords(c: number[]) { this.pointerCoords = c; }
  updatePointerCount(n: number) { this.nbrOfPointers = n; }
  updateScale(scale: number) { this.scale = scale; this.gl.viewport(0, 0, this.canvas.width * scale, this.canvas.height * scale); }

  compile(shader: WebGLShader, source: string) {
    const gl = this.gl;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      console.error("Shader error:", gl.getShaderInfoLog(shader));
  }

  test(source: string) {
    const gl = this.gl;
    const s = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(s, source); gl.compileShader(s);
    const r = gl.getShaderParameter(s, gl.COMPILE_STATUS) ? null : gl.getShaderInfoLog(s);
    gl.deleteShader(s); return r;
  }

  reset() {
    const gl = this.gl;
    if (this.program && !gl.getProgramParameter(this.program, gl.DELETE_STATUS)) {
      if (this.vs) { gl.detachShader(this.program, this.vs); gl.deleteShader(this.vs); }
      if (this.fs) { gl.detachShader(this.program, this.fs); gl.deleteShader(this.fs); }
      gl.deleteProgram(this.program);
    }
  }

  setup() {
    const gl = this.gl;
    this.vs = gl.createShader(gl.VERTEX_SHADER)!;
    this.fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    this.compile(this.vs, this.vertexSrc);
    this.compile(this.fs, this.shaderSource);
    this.program = gl.createProgram() as ShaderProgram;
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      console.error(gl.getProgramInfoLog(this.program));
  }

  init() {
    const gl = this.gl;
    const p = this.program!;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(p, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    p.resolution = gl.getUniformLocation(p, "resolution");
    p.time = gl.getUniformLocation(p, "time");
    p.move = gl.getUniformLocation(p, "move");
    p.touch = gl.getUniformLocation(p, "touch");
    p.pointerCount = gl.getUniformLocation(p, "pointerCount");
    p.pointers = gl.getUniformLocation(p, "pointers");
  }

  render(now = 0) {
    const gl = this.gl;
    const p = this.program;
    if (!p || gl.getProgramParameter(p, gl.DELETE_STATUS)) return;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.uniform2f(p.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(p.time, now * 1e-3);
    gl.uniform2f(p.move, ...(this.mouseMove as [number, number]));
    gl.uniform2f(p.touch, ...(this.mouseCoords as [number, number]));
    gl.uniform1i(p.pointerCount, this.nbrOfPointers);
    gl.uniform2fv(p.pointers, this.pointerCoords);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// ── POINTER HANDLER ────────────────────────────────────────────────────────
class PointerHandler {
  private scale: number;
  private active = false;
  private pointers = new Map<number, number[]>();
  private lastCoords = [0, 0];
  private moves = [0, 0];

  constructor(element: HTMLCanvasElement, scale: number) {
    this.scale = scale;
    const map = (el: HTMLCanvasElement, sc: number, x: number, y: number) =>
      [x * sc, el.height - y * sc];

    element.addEventListener("pointerdown", (e) => {
      this.active = true;
      this.pointers.set(e.pointerId, map(element, this.scale, e.clientX, e.clientY));
    });
    element.addEventListener("pointerup", (e) => {
      if (this.count === 1) this.lastCoords = this.first;
      this.pointers.delete(e.pointerId);
      this.active = this.pointers.size > 0;
    });
    element.addEventListener("pointerleave", (e) => {
      if (this.count === 1) this.lastCoords = this.first;
      this.pointers.delete(e.pointerId);
      this.active = this.pointers.size > 0;
    });
    element.addEventListener("pointermove", (e) => {
      if (!this.active) return;
      this.lastCoords = [e.clientX, e.clientY];
      this.pointers.set(e.pointerId, map(element, this.scale, e.clientX, e.clientY));
      this.moves = [this.moves[0] + e.movementX, this.moves[1] + e.movementY];
    });
  }

  updateScale(s: number) { this.scale = s; }
  get count() { return this.pointers.size; }
  get move() { return this.moves; }
  get coords() { return this.pointers.size > 0 ? Array.from(this.pointers.values()).flat() : [0, 0]; }
  get first(): number[] { return this.pointers.values().next().value ?? this.lastCoords; }
}

// ── HOOK ───────────────────────────────────────────────────────────────────
const useShaderBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const rendRef   = useRef<WebGLRenderer | null>(null);
  const ptrRef    = useRef<PointerHandler | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = Math.max(1, 0.5 * window.devicePixelRatio);

    rendRef.current = new WebGLRenderer(canvas, dpr);
    ptrRef.current  = new PointerHandler(canvas, dpr);
    rendRef.current.setup();
    rendRef.current.init();

    const resize = () => {
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      rendRef.current?.updateScale(dpr);
    };
    resize();

    if (rendRef.current.test(defaultShaderSource) === null)
      rendRef.current.updateShader(defaultShaderSource);

    const loop = (now: number) => {
      const r = rendRef.current, p = ptrRef.current;
      if (!r || !p) return;
      r.updateMouse(p.first);
      r.updatePointerCount(p.count);
      r.updatePointerCoords(p.coords);
      r.updateMove(p.move);
      r.render(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop(0);

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      rendRef.current?.reset();
    };
  }, []);

  return canvasRef;
};

// ── HERO COMPONENT ─────────────────────────────────────────────────────────
const Hero: React.FC<HeroProps> = ({ trustBadge, headline, subtitle, buttons, className = "" }) => {
  const canvasRef = useShaderBackground();
  const glowX = useSpring(-999, { stiffness: 120, damping: 22, mass: 0.7 });
  const glowY = useSpring(-999, { stiffness: 120, damping: 22, mass: 0.7 });
  const [showGlow, setShowGlow] = useState(false);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    glowX.set(event.clientX - bounds.left - 176);
    glowY.set(event.clientY - bounds.top - 176);
    if (!showGlow) {
      setShowGlow(true);
    }
  };

  const handlePointerLeave = () => {
    setShowGlow(false);
  };

  return (
    <div
      className={`relative h-screen w-full overflow-hidden bg-black ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain touch-none"
        style={{ background: "black" }}
      />

      <div className="absolute inset-0 z-[11] overflow-hidden opacity-40 [mask-image:radial-gradient(circle_at_center,white,transparent_76%)]">
        <Boxes rowCount={32} colCount={18} />
      </div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute z-[12] size-[24rem] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.22)_0%,rgba(249,115,22,0.14)_32%,rgba(245,158,11,0.06)_52%,transparent_72%)] blur-3xl"
        style={{ x: glowX, y: glowY }}
        animate={{ opacity: showGlow ? 1 : 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />

      {/* dark vignette so text pops */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_22%,rgba(251,191,36,0.18),transparent_28%),linear-gradient(to_bottom,rgba(0,0,0,0.2),transparent_42%,rgba(0,0,0,0.72))]" />

      {/* Content */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4 text-white">

        {/* Trust badge */}
        {trustBadge && (
          <div className="mb-8">
            <div className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"
              style={{ background: "rgba(249,115,22,.1)", border: "1px solid rgba(253,186,116,.28)", backdropFilter: "blur(12px)" }}>
              {trustBadge.icons?.map((icon, i) => <span key={i}>{icon}</span>)}
              <span style={{ color: "rgba(255,237,213,.92)" }}>{trustBadge.text}</span>
            </div>
          </div>
        )}

        {/* Headline */}
        <div className="mx-auto mb-6 max-w-5xl space-y-2 text-center">
          <h1 className="text-5xl font-bold md:text-7xl lg:text-8xl"
            style={{ color: "#fdba74", textShadow: "0 0 30px rgba(251,191,36,0.22)" }}>
            {headline.line1}
          </h1>
          <h1 className="text-5xl font-bold md:text-7xl lg:text-8xl"
            style={{ color: "#f59e0b", textShadow: "0 0 30px rgba(249,115,22,0.22)" }}>
            {headline.line2}
          </h1>
        </div>

        {/* Subtitle */}
        <p className="max-w-2xl text-center text-lg md:text-xl"
          style={{ color: "rgba(255,237,213,.88)", lineHeight: 1.7 }}>
          {subtitle}
        </p>

        {/* Buttons */}
        {buttons && (
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            {buttons.primary && (
              <button onClick={buttons.primary.onClick}
                className="px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 hover:scale-105"
                style={{ background: "linear-gradient(135deg,#f97316,#facc15)", color: "#1f1202", boxShadow: "0 0 32px rgba(249,115,22,.28)" }}>
                {buttons.primary.text}
              </button>
            )}
            {buttons.secondary && (
              <button onClick={buttons.secondary.onClick}
                className="px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 hover:scale-105"
                style={{ background: "rgba(249,115,22,.1)", border: "1px solid rgba(253,186,116,.32)", color: "rgba(255,237,213,.92)", backdropFilter: "blur(8px)" }}>
                {buttons.secondary.text}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Hero;
