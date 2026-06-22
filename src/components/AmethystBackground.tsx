import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function makeCrystalMaterial(color: number, opacity: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.28,
    metalness: 0.02,
    transmission: 0.28,
    thickness: 0.75,
    transparent: true,
    opacity,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
    emissive: new THREE.Color(color).multiplyScalar(0.12),
  });
}

function makeCrystal(radius: number, height: number, color: number) {
  const group = new THREE.Group();
  const sides = 6;
  const bodyHeight = height * 0.74;
  const tipHeight = height * 0.26;
  const material = makeCrystalMaterial(color, 0.72);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.78, radius, bodyHeight, sides, 1, false),
    material,
  );
  body.position.y = bodyHeight * 0.5;
  group.add(body);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.78, tipHeight, sides), material.clone());
  tip.position.y = bodyHeight + tipHeight * 0.5;
  group.add(tip);

  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 });
  const bodyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edgeMaterial);
  bodyEdges.position.copy(body.position);
  group.add(bodyEdges);

  const tipEdges = new THREE.LineSegments(new THREE.EdgesGeometry(tip.geometry), edgeMaterial.clone());
  tipEdges.position.copy(tip.position);
  group.add(tipEdges);

  return group;
}

function makeCluster() {
  const cluster = new THREE.Group();
  const specs = [
    { x: 0, z: 0, r: 0.54, h: 2.95, c: 0x9b5cff, rx: -0.08, rz: 0.04 },
    { x: -0.72, z: 0.2, r: 0.38, h: 2.15, c: 0x7c3aed, rx: 0.08, rz: 0.22 },
    { x: 0.76, z: 0.12, r: 0.34, h: 2.05, c: 0xc084fc, rx: 0.02, rz: -0.2 },
    { x: -1.2, z: -0.1, r: 0.28, h: 1.58, c: 0xa855f7, rx: -0.02, rz: 0.36 },
    { x: 1.18, z: -0.18, r: 0.26, h: 1.5, c: 0xe879f9, rx: 0.12, rz: -0.34 },
  ];

  specs.forEach((spec) => {
    const crystal = makeCrystal(spec.r, spec.h, spec.c);
    crystal.position.set(spec.x, -1.25, spec.z);
    crystal.rotation.set(spec.rx, 0, spec.rz);
    cluster.add(crystal);
  });

  const base = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.45, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a183b, roughness: 0.78, metalness: 0.04 }),
  );
  base.position.set(0, -1.48, 0);
  base.scale.set(1.25, 0.32, 0.72);
  base.rotation.set(0.12, 0.42, -0.04);
  cluster.add(base);

  return cluster;
}

function makeDust() {
  const count = 180;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5.2;
    positions[i * 3 + 2] = -1.5 - Math.random() * 4.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xd8b4fe,
      size: 0.022,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
}

export function AmethystBackground() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090912, 0.12);

    const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.24, 6.3);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x7c3aed, 1.05));

    const key = new THREE.PointLight(0xf0abfc, 7.5, 12);
    key.position.set(-2.5, 2.8, 3.2);
    scene.add(key);

    const rim = new THREE.PointLight(0x38bdf8, 4.6, 10);
    rim.position.set(3.1, 0.8, 2);
    scene.add(rim);

    const cluster = makeCluster();
    cluster.position.set(1.65, -0.12, 0);
    cluster.rotation.set(-0.12, -0.38, 0.08);
    scene.add(cluster);

    const dust = makeDust();
    scene.add(dust);

    const clock = new THREE.Clock();
    let raf = 0;

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.position.z = width < 720 ? 7.4 : 6.3;
      cluster.position.x = width < 720 ? 0.55 : 1.65;
      cluster.scale.setScalar(width < 720 ? 0.78 : 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const frame = () => {
      const elapsed = clock.getElapsedTime();
      cluster.rotation.y = -0.38 + Math.sin(elapsed * 0.18) * 0.22;
      cluster.rotation.x = -0.12 + Math.sin(elapsed * 0.12) * 0.04;
      dust.rotation.y = elapsed * 0.025;
      key.intensity = 6.8 + Math.sin(elapsed * 0.9) * 0.9;
      renderer.render(scene, camera);
      if (!reduceMotion) raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  return <div ref={hostRef} className="amethyst-bg" aria-hidden />;
}
