import { useEffect, useRef } from 'react';

// Анимированный кубический фрактал (Menger sponge) на WebGL — живой фон всего приложения.
// Рейтрейсинг во фрагментном шейдере: куб, бесконечно вложенный в себя, мягко вращается и светится.

const VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

float maxc(vec3 p){ return max(p.x, max(p.y, p.z)); }
float sdBox(vec3 p, vec3 b){ vec3 d = abs(p) - b; return min(maxc(d), 0.0) + length(max(d, 0.0)); }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,s, 0.,1.,0., -s,0.,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,-s, 0.,s,c); }

// Дистанция до фрактала «губка Менгера»
float map(vec3 p){
  float d = sdBox(p, vec3(1.25));
  float s = 1.0;
  for(int m=0; m<4; m++){
    vec3 a = mod(p*s, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0*abs(a));
    float da = max(r.x, r.y);
    float db = max(r.y, r.z);
    float dc = max(r.z, r.x);
    float c = (min(da, min(db, dc)) - 1.0) / s;
    d = max(d, c);
  }
  return d;
}

void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_res) / u_res.y;
  float t = u_time * 0.11;

  vec3 ro = vec3(0.0, 0.0, 3.3);
  vec3 rd = normalize(vec3(uv, -1.6));
  mat3 rot = rotY(t) * rotX(t * 0.55);
  ro = rot * ro; rd = rot * rd;

  float tt = 0.0, glow = 0.0, dist = 0.0;
  bool hit = false;
  for(int i=0; i<64; i++){
    vec3 p = ro + rd * tt;
    float d = map(p);
    glow += 0.018 / (1.0 + d*d*22.0);
    if(d < 0.0015){ hit = true; dist = tt; break; }
    tt += d * 0.9;
    if(tt > 8.0) break;
  }

  vec3 indigo = vec3(0.24, 0.27, 0.55);
  vec3 steel  = vec3(0.30, 0.45, 0.72);
  vec3 cyan   = vec3(0.32, 0.62, 0.80);
  float mixv = 0.5 + 0.5 * sin(t*1.0 + uv.x*1.2);
  vec3 pal = mix(mix(indigo, steel, mixv), cyan, 0.25 + 0.2*sin(t*0.7));

  vec3 col = vec3(0.0);
  if(hit){
    float sh = 1.0 - dist / 8.0;
    col = pal * (0.18 + 0.7 * sh);
  }
  col += pal * glow * 1.15;

  float vig = smoothstep(1.5, 0.15, length(uv));
  col *= mix(0.3, 1.0, vig);
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function FractalBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = (canvas.getContext('webgl', { antialias: false, alpha: false }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return; // нет WebGL — останется CSS-фон

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');

    // Рендерим в пониженном разрешении ради производительности.
    const scale = 0.7;
    function resize() {
      const w = Math.max(1, Math.floor(window.innerWidth * scale));
      const h = Math.max(1, Math.floor(window.innerHeight * scale));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
    }
    resize();
    window.addEventListener('resize', resize);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const start = performance.now();
    function frame(now: number) {
      resize();
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={ref} className="fractal-bg" aria-hidden />;
}
