import * as THREE from 'three';

// One shared draw call and four reusable launches keep repeated clicks bounded.
const MAX_LAUNCHES = 4;
const MAX_SPARKS = 144;
const TRAIL_SAMPLES = 4;
const MAX_POINTS = MAX_LAUNCHES * (MAX_SPARKS * TRAIL_SAMPLES + 20);
const PALETTE = [0xffda97, 0xabe4e2, 0xeab5c9].map(value => new THREE.Color(value));

export function createFireworks(scene, textures, {reducedMotion = false} = {}) {
  const positions = new Float32Array(MAX_POINTS * 3);
  const colors = new Float32Array(MAX_POINTS * 3);
  const sizes = new Float32Array(MAX_POINTS);
  const alphas = new Float32Array(MAX_POINTS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
    vertexShader: `
      attribute vec3 color;
      attribute float aSize, aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * 390.0 / max(-viewPosition.z, 1.0), 1.0, 24.0);
        vColor = color;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float radius = length(gl_PointCoord - 0.5) * 2.0;
        if (radius > 1.0) discard;
        float halo = pow(1.0 - radius, 2.3);
        float core = exp(-radius * radius * 24.0);
        gl_FragColor = vec4(vColor * (1.0 + core * 0.35), (halo * 0.6 + core * 0.4) * vAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'interactive-fireworks';
  points.frustumCulled = false;
  points.visible = false;
  // Spark heads and their tails are small enough to remain subtle by the moon.
  points.renderOrder = 2;
  scene.add(points);

  const launches = Array.from({length: MAX_LAUNCHES}, () => ({
    active: false,
    center: new THREE.Vector3(),
    velocity: new Float32Array(MAX_SPARKS * 3),
    variation: new Float32Array(MAX_SPARKS),
    born: 0,
    flight: 1,
    duration: 2.8,
    rise: 6,
    count: MAX_SPARKS,
    samples: TRAIL_SAMPLES,
    color: PALETTE[0],
  }));
  let launchNumber = 0;
  let disposed = false;

  function launch(position, time, quality = 'high') {
    if (disposed || !Number.isFinite(time) || !position ||
      ![position.x, position.y, position.z].every(Number.isFinite)) return false;
    const activeLimit = reducedMotion || quality === 'low' ? 2 : MAX_LAUNCHES;
    if (launches.reduce((total, entry) => total + Number(entry.active), 0) >= activeLimit) return false;
    const entry = launches.find(item => !item.active);
    if (!entry) return false;
    const gentle = reducedMotion;
    entry.center.copy(position);
    entry.born = time;
    entry.flight = gentle ? 0.8 : 1.05;
    entry.duration = gentle ? 2.2 : 2.9;
    entry.rise = gentle ? 2.8 : Math.min(6.5, Math.max(3, position.y - 1.5));
    entry.count = gentle ? 42 : quality === 'low' ? 56 : quality === 'balanced' ? 96 : MAX_SPARKS;
    entry.samples = gentle || quality === 'low' ? 2 : TRAIL_SAMPLES;
    entry.color = PALETTE[launchNumber++ % PALETTE.length];
    for (let index = 0; index < entry.count; index++) {
      // Evenly spaced directions give a spherical chrysanthemum burst.
      const height = 1 - 2 * (index + 0.5) / entry.count;
      const angle = index * 2.399963229728653 + Math.random() * 0.14;
      const radius = Math.sqrt(1 - height * height);
      const speed = (gentle ? 1.1 : 2.25) * (0.82 + Math.random() * 0.28);
      entry.velocity[index * 3] = Math.cos(angle) * radius * speed;
      entry.velocity[index * 3 + 1] = height * speed;
      entry.velocity[index * 3 + 2] = Math.sin(angle) * radius * speed;
      entry.variation[index] = 0.82 + Math.random() * 0.18;
    }
    entry.active = true;
    points.visible = true;
    return true;
  }

  function update(time, delta) {
    if (disposed || !Number.isFinite(time)) return;
    let written = 0;
    const write = (x, y, z, color, size, alpha) => {
      const offset = written * 3;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
      sizes[written] = size;
      alphas[written++] = alpha;
    };
    for (const entry of launches) {
      if (!entry.active) continue;
      const age = Math.max(0, time - entry.born);
      if (age > entry.flight + entry.duration) {
        entry.active = false;
        continue;
      }
      const {center, color} = entry;
      if (age < entry.flight) {
        const progress = age / entry.flight;
        for (let sample = 0; sample < 14; sample++) {
          const tailProgress = Math.max(0, progress - sample * 0.016);
          const riseProgress = 1 - Math.pow(1 - tailProgress, 1.6);
          write(center.x + Math.sin(tailProgress * 6) * 0.045,
            center.y - entry.rise + entry.rise * riseProgress,
            center.z, PALETTE[0], sample === 0 ? 0.38 : 0.21,
            (1 - sample / 14) * (sample === 0 ? 0.95 : 0.5));
        }
        continue;
      }
      const burstAge = age - entry.flight;
      const fade = Math.pow(Math.max(0, 1 - burstAge / entry.duration), 1.3);
      for (let index = 0; index < entry.count; index++) {
        const offset = index * 3;
        for (let sample = 0; sample < entry.samples; sample++) {
          const sampleAge = burstAge - sample * 0.045;
          if (sampleAge < 0) continue;
          const travel = (1 - Math.exp(-0.45 * sampleAge)) / 0.45;
          const shimmer = 0.88 + Math.sin(sampleAge * 11 + index * 1.7) * 0.12;
          write(center.x + entry.velocity[offset] * travel,
            center.y + entry.velocity[offset + 1] * travel - 0.28 * sampleAge * sampleAge,
            center.z + entry.velocity[offset + 2] * travel,
            color, sample === 0 ? 0.35 : 0.23,
            fade * entry.variation[index] * shimmer * (1 - sample / entry.samples) * (sample ? 0.6 : 1));
        }
      }
    }
    geometry.setDrawRange(0, written);
    points.visible = written > 0;
    if (written) for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
  }

  return {
    launch,
    update,
    get activeCount() { return launches.reduce((total, entry) => total + Number(entry.active), 0); },
    dispose() {
      if (disposed) return;
      disposed = true;
      launches.forEach(entry => { entry.active = false; });
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
