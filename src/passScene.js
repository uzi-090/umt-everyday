import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function roundedShape(width, height, radius, x = 0, y = 0) {
  const s = new THREE.Shape();
  const l = x - width / 2, r = x + width / 2, b = y - height / 2, t = y + height / 2;
  s.moveTo(l + radius, b);
  s.lineTo(r - radius, b); s.quadraticCurveTo(r, b, r, b + radius);
  s.lineTo(r, t - radius); s.quadraticCurveTo(r, t, r - radius, t);
  s.lineTo(l + radius, t); s.quadraticCurveTo(l, t, l, t - radius);
  s.lineTo(l, b + radius); s.quadraticCurveTo(l, b, l + radius, b);
  return s;
}

function extrude(shape, depth, bevel = .035) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 5, curveSegments: 24, steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function clothTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#858585'; ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) {
    ctx.fillStyle = (x / 8 + y / 8) % 2 ? '#bcbcbc' : '#505050';
    ctx.fillRect(x, y + 1, 6, 3);
    ctx.fillStyle = '#dadada'; ctx.fillRect(x + 2, y + 1, 2, 2);
    ctx.fillStyle = '#424242'; ctx.fillRect(x + 6, y + 4, 2, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}

function wovenColor() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a7b507'; ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 12) for (let x = 0; x < 128; x += 12) {
    const shift = y % 24 ? 6 : 0;
    ctx.fillStyle = '#879600'; ctx.fillRect(x + shift, y + 1, 9, 8);
    ctx.fillStyle = '#c4d21d'; ctx.fillRect(x + shift + 1, y, 7, 6);
    ctx.fillStyle = '#e0e94c'; ctx.fillRect(x + shift + 2, y, 4, 2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1, 2);
  return map;
}

function graphiteTexture() {
  const size = 512;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 17017;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 100 + (seed >>> 26);
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = value;
    pixels[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

function graphiteColor(bump) {
  const pixels = new Uint8Array(bump.image.data.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const value = 234 + Math.round((bump.image.data[i] - 100) * .25);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value; pixels[i + 3] = 255;
  }
  const map = new THREE.DataTexture(pixels, 512, 512);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.needsUpdate = true;
  return map;
}

function addLettering(group) {
  // Solid letter outlines avoid font atlas/mipmap blur at the compact display size.
  const material = new THREE.MeshBasicMaterial({ color: '#f4f4f1' });
  const u = new THREE.Shape();
  u.moveTo(0, .15); u.lineTo(.025, .15); u.lineTo(.025, .048);
  u.quadraticCurveTo(.025, .025, .056, .025); u.quadraticCurveTo(.087, .025, .087, .048);
  u.lineTo(.087, .15); u.lineTo(.112, .15); u.lineTo(.112, .044);
  u.quadraticCurveTo(.112, 0, .056, 0); u.quadraticCurveTo(0, 0, 0, .044); u.closePath();
  const m = new THREE.Shape();
  m.moveTo(0, 0); m.lineTo(.025, 0); m.lineTo(.025, .106); m.lineTo(.062, .049);
  m.lineTo(.077, .049); m.lineTo(.114, .106); m.lineTo(.114, 0); m.lineTo(.139, 0);
  m.lineTo(.139, .15); m.lineTo(.114, .15); m.lineTo(.07, .082);
  m.lineTo(.025, .15); m.lineTo(0, .15); m.closePath();
  const t = new THREE.Shape();
  t.moveTo(0, .15); t.lineTo(.126, .15); t.lineTo(.126, .125); t.lineTo(.076, .125);
  t.lineTo(.076, 0); t.lineTo(.05, 0); t.lineTo(.05, .125); t.lineTo(0, .125); t.closePath();
  for (const [shape, x] of [[u, -.209], [m, -.072], [t, .092]]) {
    const mesh = new THREE.Mesh(extrude(shape, .002, .0008), material);
    mesh.name = 'UMT lettering'; mesh.scale.setScalar(1.45); mesh.position.set(x * 1.45, .30, .132); group.add(mesh);
  }
}

export function createPassModel() {
  const group = new THREE.Group();
  const grain = graphiteTexture();
  const body = new THREE.MeshPhysicalMaterial({ color: '#292a2d', map: graphiteColor(grain), metalness: .26, roughness: .91, roughnessMap: grain, bumpMap: grain, bumpScale: .008, clearcoat: .12, clearcoatRoughness: .45 });
  const metal = new THREE.MeshStandardMaterial({ color: '#b6b8bd', metalness: .94, roughness: .25 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: '#d4c200', metalness: .55, roughness: .27, clearcoat: .26, clearcoatRoughness: .22 });
  const lineMaterial = new THREE.MeshStandardMaterial({ color: '#636569', metalness: .55, roughness: .42 });
  const badge = roundedShape(1.18, 1.78, .15);
  const slot = roundedShape(.43, .13, .06, 0, .70);
  badge.holes.push(new THREE.Path(slot.getPoints(24).reverse()));
  const edge = new THREE.Mesh(extrude(badge, .115, .035), metal);
  group.add(edge);
  const face = new THREE.Mesh(extrude(badge, .045, .025), body);
  face.position.z = .071;
  group.add(face);

  const check = new THREE.Shape();
  check.moveTo(-.30, -.02); check.lineTo(-.20, .08); check.lineTo(-.055, -.075);
  check.lineTo(.245, .265); check.quadraticCurveTo(.27, .29, .295, .265);
  check.lineTo(.36, .20); check.quadraticCurveTo(.375, .18, .35, .15);
  check.lineTo(-.015, -.265); check.quadraticCurveTo(-.045, -.30, -.08, -.265);
  check.lineTo(-.30, -.055); check.quadraticCurveTo(-.32, -.04, -.30, -.02);
  const tick = new THREE.Mesh(extrude(check, .065, .018), yellow);
  tick.position.set(0, -.06, .15); group.add(tick);

  for (const [y, width] of [[-.49, .67], [-.63, .52]]) {
    const line = new THREE.Mesh(extrude(roundedShape(width, .033, .016), .026, .009), lineMaterial);
    line.position.set(0, y, .133); group.add(line);
  }

  addLettering(group);

  // A woven strap actually passes through the cut-out and folds over the top.
  const positions = [], uvs = [], indices = [];
  const segments = 64, strapWidth = .29;
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const y = .955 + Math.cos(angle) * .285;
    const z = Math.sin(angle) * .155;
    for (const x of [-strapWidth / 2, strapWidth / 2]) positions.push(x, y, z);
    uvs.push(0, i / segments, 1, i / segments);
    if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const strapGeometry = new THREE.BufferGeometry();
  strapGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  strapGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  strapGeometry.setIndex(indices); strapGeometry.computeVertexNormals();
  const weave = clothTexture();
  const strapMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', map: wovenColor(), roughness: .84, metalness: 0, bumpMap: weave, bumpScale: .026, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(strapGeometry, strapMaterial));

  // Instanced thread loops add visible weave relief without hundreds of draw calls.
  const stitchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.012, .012, 0), new THREE.Vector3(-.008, -.002, .002),
    new THREE.Vector3(0, -.010, .004), new THREE.Vector3(.008, -.002, .002), new THREE.Vector3(.012, .012, 0),
  ]);
  const threads = new THREE.InstancedMesh(new THREE.TubeGeometry(stitchCurve, 8, .0038, 4, false), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .91 }), 432);
  const transform = new THREE.Object3D();
  const threadColors = ['#c4d216', '#9fad07', '#d6df3a'];
  for (let row = 0; row < 54; row++) for (let col = 0; col < 8; col++) {
    const angle = (row + .5) / 54 * Math.PI * 2;
    const y = .955 + Math.cos(angle) * .289;
    const z = Math.sin(angle) * .159;
    transform.position.set((col - 3.5) * .033 + (row % 2 ? .003 : -.003), y, z);
    transform.rotation.x = Math.atan2(Math.cos(angle) * .155, -Math.sin(angle) * .285) + Math.PI;
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    threads.setMatrixAt(row * 8 + col, transform.matrix);
    threads.setColorAt(row * 8 + col, new THREE.Color(threadColors[(row + col) % 3]));
  }
  threads.instanceMatrix.needsUpdate = true;
  group.add(threads);
  group.traverse(node => {
    if (node.isMesh && !node.material.isMeshBasicMaterial) { node.castShadow = true; node.receiveShadow = true; }
  });
  group.position.y = -.12;
  return group;
}

export function createPassScene(world, reducedMotion) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  // Present the focused mesh directly through WebGL at the display's pixel ratio.
  renderer.setPixelRatio(1);
  renderer.domElement.className = 'pass-webgl';
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.36, 1.36, 1.632, -1.632, .1, 30);
  camera.position.set(0, 0, 6);
  camera.zoom = 1.22; camera.updateProjectionMatrix();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .48;
  room.dispose(); pmrem.dispose();
  const ambient = new THREE.AmbientLight(0xffffff, .35); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(-3, 5, 6); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: .5, far: 15 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -.0002; key.shadow.normalBias = .005; key.shadow.radius = 2;
  const rim = new THREE.DirectionalLight(0xdbe4ff, 1.5); rim.position.set(4, 2, -2); scene.add(rim);
  const model = createPassModel(); scene.add(model);
  const targets = [...world.querySelectorAll('.glyph-layer')].map(layer => ({ layer, holder: layer.querySelector('.student-pass'), canvas: layer.querySelector('.pass-canvas'), last: null }));
  let frame = 0, disposed = false, active = true, width = 0, height = 0, displayRatio = 0, lastLive = null;
  const setPose = pose => model.rotation.set(-.09 + pose * .09, .37 + pose * .22, .105 - pose * .055);
  const copyFrame = target => {
    const ctx = target.canvas.getContext('2d');
    ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
    ctx.drawImage(renderer.domElement, 0, 0);
    target.holder.classList.add('is-ready');
  };
  const paint = () => {
    frame = 0;
    if (disposed || !active || document.hidden) return;
    const focused = targets.find(target => target.layer.dataset.focused === 'true') || targets[0];
    const holderStyle = getComputedStyle(focused.holder);
    const nextWidth = parseFloat(holderStyle.width), nextHeight = parseFloat(holderStyle.height);
    if (!nextWidth || !nextHeight) return;
    const pixelRatio = window.devicePixelRatio || 1;
    if (nextWidth !== width || nextHeight !== height || displayRatio !== pixelRatio) {
      width = nextWidth; height = nextHeight; displayRatio = pixelRatio;
      // Integer physical buffers avoid Three.js flooring fractional DPR dimensions.
      const physicalWidth = Math.round(width * pixelRatio), physicalHeight = Math.round(height * pixelRatio);
      renderer.setSize(physicalWidth, physicalHeight, false);
      camera.left = -1.632 * physicalWidth / physicalHeight;
      camera.right = -camera.left; camera.updateProjectionMatrix();
      targets.forEach(target => {
        target.canvas.width = renderer.domElement.width; target.canvas.height = renderer.domElement.height;
        target.last = null;
      });
      lastLive = null;
    }
    if (renderer.domElement.parentElement !== focused.holder) {
      targets.forEach(target => target.holder.classList.remove('has-live-scene'));
      focused.holder.appendChild(renderer.domElement);
      focused.holder.classList.add('has-live-scene');
      lastLive = null;
    }
    let needsLiveRender = false;
    for (const target of targets) {
      if (target === focused) continue;
      const distance = Number(target.layer.dataset.distance || 0);
      if (Math.abs(distance) > 1.45 || (reducedMotion && Math.abs(distance) > .1)) continue;
      const pose = reducedMotion ? 0 : Math.round(distance * 60) / 60;
      if (target.last === pose) continue;
      setPose(pose); renderer.render(scene, camera); copyFrame(target);
      target.last = pose; needsLiveRender = true;
    }
    const distance = Number(focused.layer.dataset.distance || 0);
    const pose = reducedMotion ? 0 : Math.round(distance * 60) / 60;
    if (lastLive !== pose || needsLiveRender) {
      setPose(pose); renderer.render(scene, camera); copyFrame(focused);
      focused.last = pose; lastLive = pose;
    }
    world.dataset.passRenderer = 'ready';
  };
  const request = () => { if (!frame && !disposed && active && !document.hidden) frame = requestAnimationFrame(paint); };
  const restore = () => { targets.forEach(t => { t.last = null; }); lastLive = null; request(); };
  const lost = event => {
    event.preventDefault();
    targets.forEach(t => t.holder.classList.remove('is-ready', 'has-live-scene'));
    world.dataset.passRenderer = 'fallback';
  };
  world.addEventListener('depthframe', request);
  document.addEventListener('visibilitychange', request);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.domElement.addEventListener('webglcontextrestored', restore);
  const observer = new ResizeObserver(request);
  targets.forEach(target => observer.observe(target.holder));
  window.addEventListener('resize', restore);
  request();
  const dispose = () => {
    disposed = true; cancelAnimationFrame(frame);
    observer.disconnect(); window.removeEventListener('resize', restore);
    world.removeEventListener('depthframe', request);
    document.removeEventListener('visibilitychange', request);
    renderer.domElement.removeEventListener('webglcontextlost', lost);
    renderer.domElement.removeEventListener('webglcontextrestored', restore);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    model.traverse(node => {
      if (!node.isMesh) return;
      geometries.add(node.geometry); materials.add(node.material);
      for (const value of Object.values(node.material)) if (value?.isTexture) textures.add(value);
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    targets.forEach(target => target.holder.classList.remove('has-live-scene'));
    renderer.domElement.remove();
    environment.dispose(); renderer.dispose(); renderer.forceContextLoss();
  };
  dispose.setActive = value => {
    if (active === value) return;
    active = value;
    if (active) request();
    else { cancelAnimationFrame(frame); frame = 0; }
  };
  dispose.setMotion = value => {
    if (reducedMotion === value) return;
    reducedMotion = value;
    restore();
  };
  return dispose;
}
