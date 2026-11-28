import {replaceSource} from './repair-hd-source.mjs';

export function optimizeReviewMain(source) {
  return replaceSource(source,[
    ["import { Sky }", "import { ReviewBudget, reviewFast, reviewPixelRatio, updateReviewDetail } from 'linterna-review-budget';\nimport { Sky }"],
    ['const DPR = Math.min(devicePixelRatio, 1.75);\nrenderer.setPixelRatio(DPR);',
      `const quality = new ReviewBudget(matchMedia('(pointer: coarse)').matches);
let profile, lastDetailAt = -Infinity, activeStageForDetail, detailScale;
let lastResizeAt = -Infinity, lastResizePixels;
const detailOrigin = new THREE.Vector3(Infinity, 0, 0);`],
    ['sun.shadow.mapSize.set(4096, 4096);', 'sun.shadow.mapSize.set(1024, 1024);'],
    ['const POOL = 10;', 'const POOL = 4;'],
    ['type: THREE.HalfFloatType, samples: 4', 'type: THREE.HalfFloatType, samples: 0'],
    ["uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },",
      "uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uBlend: { value: 1 } },"],
    ["uniform float uTime; varying vec2 vUv;",
      "uniform float uTime; uniform float uBlend; varying vec2 vUv;"],
    ["vec4 c=texture2D(tDiffuse,vUv); vec2 d=vUv-.5;",
      "vec4 original=texture2D(tDiffuse,vUv); vec4 c=original; vec2 d=vUv-.5;"],
    ["gl_FragColor=c; }`", "gl_FragColor=mix(original,c,uBlend); }`"],
    ['gtao.render = (...a) => { noAO.forEach(o => (o.visible = false)); gtaoRender(...a); noAO.forEach(o => (o.visible = true)); };',
      `gtao.render = (...args) => {
  const visible = [...noAO].filter(object => object.visible);
  for (const object of visible) object.visible = false;
  try { gtaoRender(...args); }
  finally { for (const object of visible) object.visible = true; }
};`],
    ['    b.clear = clearance(b.obstacles);', `    b.detail = [];
    b.group.traverse(mesh => { if (mesh.userData.reviewDetail) b.detail.push(mesh); });
    b.clear = clearance(b.obstacles);`],
    ['  transit = null; resetBtn.disabled = false; dirty = true;\n  assignLights(true);',
      '  transit = null; resetBtn.disabled = false; dirty = true;\n  camera.position.copy(pos);\n  assignLights(true);'],
    ['  composer.render();', `  if (window.__capture || profile?.glow > .02 || profile?.contact > .02) composer.render();
  else renderer.render(scene, camera);`],
    [`let last = 0, frames = 0, acc = 0, scale = 1;
function loop(t) {
  const dt = Math.min((t - (last || t)) / 1000, 0.045); last = t;
  if (!document.hidden && !window.__capture) {
    if (transit) stepTransit(dt); else if (keys.size) walk(dt);
    render(t);
    // adaptive resolution: keep motion smooth on modest GPUs
    frames++; acc += dt;
    if (acc > 2) { const fps = frames / acc; frames = 0; acc = 0;
      if (fps < 28 && scale > 0.6) { scale -= 0.15; resize(); } else if (fps > 50 && scale < 1) { scale = Math.min(1, scale + 0.1); resize(); } }
  }
  requestAnimationFrame(loop);
}`,
      `let last = 0;
let detailMoving;
function loop(t) {
  const dt = Math.min((t - (last || t)) / 1000, 0.045);
  last = t;
  if (!document.hidden && !window.__capture) {
    const active = Boolean(transit || keys.size);
    if (transit) stepTransit(dt); else if (keys.size) walk(dt);
    const next = quality.plan(t, active, dirty);
    if (next.draw) {
      profile = next.profile;
      reviewFast.value = quality.level < 2 ? 1 : 0;
      gtao.enabled = profile.contact > .02;
      gtao.blendIntensity = profile.contact * .85;
      bloom.enabled = profile.glow > .02;
      bloom.strength = profile.glow * .34;
      grade.enabled = profile.contact > .02;
      grade.uniforms.uBlend.value = profile.contact;
      const shadows = quality.level >= 1;
      if (renderer.shadowMap.enabled !== shadows) {
        renderer.shadowMap.enabled = shadows;
        renderer.shadowMap.needsUpdate = shadows;
      }
      if (lastResizePixels !== profile.pixels && (t - lastResizeAt >= 90 || next.resolutionSettled)) {
        resize();
        lastResizeAt = t;
        lastResizePixels = profile.pixels;
      }
      if (detailMoving !== next.moving || activeStageForDetail !== stageName ||
          (t - lastDetailAt > 140 &&
            (detailOrigin.distanceToSquared(pos) > 1 || Math.abs(detailScale - profile.distance) > .045))) {
        updateReviewDetail(built.get(stageName).detail, pos, profile.distance, next.moving);
        detailOrigin.copy(pos);
        detailScale = profile.distance;
        activeStageForDetail = stageName;
        detailMoving = next.moving;
        lastDetailAt = t;
      }
      const start = performance.now();
      render(t);
      if (next.moving) quality.observe(t, performance.now() - start);
      dirty = false;
    }
  } else if (document.hidden) {
    quality.resetFrames();
  }
  requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) dirty = true; });`],
    ['  if (!drag) return;\n  yaw -=',
      '  if (!drag || (e.clientX === drag[0] && e.clientY === drag[1])) return;\n  quality.noteMovement(performance.now());\n  yaw -='],
    [`  renderer.setPixelRatio(DPR * scale);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR * scale);
  composer.setSize(w, h);`,
      `  const ratio = reviewPixelRatio(w, h, devicePixelRatio, profile?.pixels ?? 140000);
  const width = Math.max(1, Math.round(w * ratio / 4) * 4);
  const height = Math.max(1, Math.round(h * width / w));
  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
  }`],
    ['    clear: p => clear(p),', `    clear: p => clear(p),
    quality: () => ({ level: quality.level, pixels: Math.round(profile?.pixels ?? 0),
      glow: profile?.glow, contact: profile?.contact, moving: quality.motion,
      rendered: quality.movingFrames }),`],
    ['    renderNow(t = 4000) { camera.position.copy(pos); assignLights(true); render(t); },',
      '    renderNow(t = 4000) { reviewFast.value = 0; camera.position.copy(pos); assignLights(true); render(t); },'],
  ]);
}

export function stageReviewWorkshop(source) {
  return replaceSource(source,[
    ["import { Sky }", `import {insideWorkshop,loadReviewWorkshop,workshopDescription,workshopFloor,workshopLanding,workshopReturn,workshopView} from 'linterna-review-workshop';
import { Sky }`],
    ['const STOPS = stops(), GRAPH = graph();', `const STOPS = stops(), GRAPH = graph();
STOPS.atelier = {stage: 'atelier-metric', point: workshopLanding, target: workshopView};
GRAPH.hephaestus.atelier = GRAPH.hephaestus.atelier.slice(0,-1);
GRAPH.atelier.hephaestus = [workshopReturn];
PLACES.atelier[1] = workshopDescription;
let metricWorkshop;`],
    ['const b = buildStage(name, M, S);', "const b = name === 'atelier-metric' ? metricWorkshop : buildStage(name, M, S);"],
    ['pos.set(s.point[0], EYE, s.point[1]);', "pos.set(s.point[0], EYE + (s.stage === 'atelier-metric' ? workshopFloor : 0), s.point[1]);"],
    ['wpv.set(x, EYE, z);', 'wpv.set(x, pos.y, z);'],
    ['function walkable(x, z) {', "function walkable(x, z) {\n  if (stageName === 'atelier-metric') return insideWorkshop(x,z) && clear([x,z]);"],
    ["  S = await loadStatues();\n  goStop('promenade');",
      "  const [sculptures, workshop] = await Promise.all([loadStatues(),loadReviewWorkshop()]);\n  S = sculptures;\n  metricWorkshop = workshop;\n  goStop('promenade');"],
  ]);
}

export function optimizeReviewArchitecture(source) {
  return replaceSource(source,[
    ["import * as THREE from 'three';", "import * as THREE from 'three';\nimport {clusterReviewMesh} from 'linterna-review-budget';\nconst meshProxies = new WeakMap();"],
    ['constructor(M) { this.M = M; this.map = new Map(); this.inst = new Map(); }',
      'constructor(M) { this.M = M; this.map = new Map(); this.inst = new Map(); this.detailMeshes = []; }'],
    ['  instance(key, mat, geo, matrix, color) {', `  shaft(material, height, radius, matrix) {
    const full = flutedShaft(height, radius);
    const light = cached('review-shaft:' + height + ':' + radius,
      () => new THREE.CylinderGeometry(radius * .84, radius, height, 16, 2, true).translate(0, height / 2, 0));
    this.detail(material, full, light, matrix, radius, 5, 9);
  }
  figure(material, full, matrix) {
    this.proxy(material, full, matrix, .04, .3, 3, 8);
  }
  proxy(material, full, matrix, cell, radius, moving, still) {
    if (!meshProxies.has(full)) meshProxies.set(full, clusterReviewMesh(THREE, full, cell));
    this.detail(material, full, meshProxies.get(full), matrix, radius, moving, still);
  }
  detail(material, full, light, matrix, radius, moving, still) {
    const mesh = new THREE.Mesh(full, this.M[material]);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(matrix);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.reviewDetail = {full, light, radius, moving, still,
      center: new THREE.Vector3().setFromMatrixPosition(matrix)};
    this.detailMeshes.push(mesh);
  }
  instance(key, mat, geo, matrix, color) {`],
    ['    this.map.clear(); this.inst.clear();', '    for (const mesh of this.detailMeshes) group.add(mesh);\n    this.detailMeshes.length = 0;\n    this.map.clear(); this.inst.clear();'],
    ['B.add(material, flutedShaft(shaftH, r), mat(f, x, seat, z));',
      'B.shaft(material, shaftH, r, mat(f, x, seat, z));'],
    ['export function atticBase(r) {\n  return cached(\'base\' + r.toFixed(3),',
      "export function atticBase(r, segments = 56) {\n  return cached('base' + r.toFixed(3) + ':' + segments,"],
    ['geo: lathe(pts, 56)', 'geo: lathe(pts, segments)'],
    ['B.add(material, base.geo, mat(f, x, plinthH, z));',
      'B.detail(material, base.geo, atticBase(r, 16).geo, mat(f, x, plinthH, z), r, 4, 8);'],
    ['B.add(material, cap.geo, mat(f, x, h - cap.height, z));',
      'B.proxy(material, cap.geo, mat(f, x, h - cap.height, z), r * .20, r, 4, 8);'],
    ["    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);",
      "    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(m.userData.reviewDecal && k === 'uv')) g.deleteAttribute(k);"],
    ["B.add('gold', STAR, mat(f, cx, y + 0.033, cz, Math.PI / 2, 0, 0, 1, 1, 1));",
      "B.add(cofferStar().material, cofferStar().plane, mat(f, cx, y + 0.027, cz, Math.PI / 2, 0, 0));"],
    ['const STAR = (() => {', `let starDecal;
function cofferStar() {
  if (starDecal) return starDecal;
  const map = canvasTex(128, 128, (ctx) => {
    ctx.translate(64, 64);
    for (let i = 0; i <= 16; i++) {
      const angle = i * Math.PI / 8;
      const radius = i % 2 ? 17 : 57;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const gilding = ctx.createLinearGradient(-48, -48, 45, 43);
    gilding.addColorStop(0, '#f4d894');
    gilding.addColorStop(.45, '#b99046');
    gilding.addColorStop(.55, '#e9c578');
    gilding.addColorStop(1, '#806030');
    ctx.fillStyle = gilding;
    ctx.fill();
    ctx.strokeStyle = '#775323';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  const material = new THREE.MeshStandardMaterial({map, alphaTest: .4, roughness: .45, metalness: .42});
  material.userData.reviewDecal = true;
  starDecal = {material, plane: new THREE.PlaneGeometry(.168, .168)};
  return starDecal;
}

const STAR = (() => {`],
  ]).replace(/\nconst STAR = \(\(\) => \{[\s\S]*?\n\}\)\(\);/, '');
}

export function optimizeReviewMaterials(source) {
  return replaceSource(source,[
    ["import * as THREE from 'three';", `import * as THREE from 'three';
import {reviewFast} from 'linterna-review-budget';

// A repeatable noise tile replaces simplex octaves in the moving view.
const reviewNoise = (() => {
  const n = 128, data = new Uint8Array(n * n);
  const gridValue = (x, y) => {
    let k = Math.imul(x + 1, 0x6e624eb7) ^ Math.imul(y + 3, 0x9e3779b1);
    k = Math.imul(k ^ (k >>> 16), 0x7feb352d);
    return ((k ^ (k >>> 15)) >>> 0) / 4294967295;
  };
  const noiseAt = (x, y, cells) => {
    x = x * cells / n; y = y * cells / n;
    const i = Math.floor(x), j = Math.floor(y);
    const fx = x - i, fy = y - j;
    const a = fx * fx * (3 - 2 * fx), b = fy * fy * (3 - 2 * fy);
    const right = (i + 1) % cells, bottom = (j + 1) % cells;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(gridValue(i,j), gridValue(right,j), a),
      THREE.MathUtils.lerp(gridValue(i,bottom), gridValue(right,bottom), a), b);
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    data[y * n + x] = Math.round(255 * (.57 * noiseAt(x,y,16) + .28 * noiseAt(x,y,32) + .15 * noiseAt(x,y,64)));
  }
  const tex = new THREE.DataTexture(data,n,n,THREE.RedFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return {value: tex};
})();`],
    ['float snoise(vec3 v){', `uniform float uReviewFast;
uniform sampler2D uReviewNoise;
float reviewNoiseAt(vec3 v){
  return texture2D(uReviewNoise, v.xy*.069 + v.z*vec2(.029,.047)).r * 2. - 1.;
}
float snoise(vec3 v){
  if(uReviewFast > .5) return reviewNoiseAt(v);`],
    ['float fbm(vec3 p){float', 'float fbm(vec3 p){if(uReviewFast>.5)return reviewNoiseAt(p);float'],
    ['float fbm3(vec3 p){float', 'float fbm3(vec3 p){if(uReviewFast>.5)return reviewNoiseAt(p*1.1);float'],
    ['Object.assign(sh.uniforms, u);', `Object.assign(sh.uniforms, u);
    sh.uniforms.uReviewFast = reviewFast;
    sh.uniforms.uReviewNoise = reviewNoise;`],
    ['normal=hdPerturb(-vViewPosition,normal,vec2(dFdx(hdH),dFdy(hdH)),faceDirection);',
      'if(uReviewFast<.5) normal=hdPerturb(-vViewPosition,normal,vec2(dFdx(hdH),dFdy(hdH)),faceDirection);'],
  ]);
}

export function optimizeReviewNature(source) {
  return replaceSource(source,[
    ["import * as THREE from 'three';", "import * as THREE from 'three';\nimport { distributeSamples, spatialTiles } from 'linterna-review-budget';"],
    ['const seg = Math.max(6, pts.length * 6), rad = 10;', 'const seg = Math.max(4, pts.length * 3), rad = 6;'],
    ['      list.forEach(g => { g.deleteAttribute(\'uv\'); });\n      const mesh = new THREE.Mesh(mergeGeometries(list), this.mats[mat]);\n      mesh.castShadow = mesh.receiveShadow = true;\n      group.add(mesh);',
      `      list.forEach(g => { g.deleteAttribute('uv'); g.computeBoundingBox(); });
      for (const patch of spatialTiles(list, g => {
        const box = g.boundingBox;
        return [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
      }, 18)) {
        const mesh = new THREE.Mesh(mergeGeometries(patch), this.mats[mat]);
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
      }`],
    ['    for (const [kind, list] of Object.entries(this.cards)) {',
      '    for (const [kind, cards] of Object.entries(this.cards)) for (const patch of spatialTiles(cards, c => [c.p.x, c.p.z], 18)) {\n      const list = distributeSamples(patch);'],
    ['      const mesh = new THREE.Mesh(g, this.mats.foliage[kind]);',
      `      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.mats.foliage[kind]);
      mesh.userData.reviewDetail = {center: g.boundingSphere.center, radius: g.boundingSphere.radius, total: idx.length};`],
    ['function clumpGeometry() {', 'function clumpGeometry(blades, segments) {'],
    ['for (let b = 0; b < 16; b++)', 'for (let b = 0; b < blades; b++)'],
    ['for (let s = 0; s <= 3; s++) {\n      const t = s / 3', 'for (let s = 0; s <= segments; s++) {\n      const t = s / segments'],
    ['for (let s = 0; s < 3; s++) { const i = base + s * 2;', 'for (let s = 0; s < segments; s++) { const i = base + s * 2;'],
    ['export function grass(points, scaleFn) {', 'export function grass(points) {'],
    ['  const geo = clumpGeometry();\n  const im = new THREE.InstancedMesh(geo, mat, points.length);',
      `  const group = new THREE.Group();
  const full = clumpGeometry(16, 3), light = clumpGeometry(6, 2);
  for (const patch of spatialTiles(points, p => [p[0], p[2]], 8)) {
    group.add(grassPatch(distributeSamples(patch), mat, full, light));
  }
  return group;
}
function grassPatch(points, mat, full, light) {
  const im = new THREE.InstancedMesh(full, mat, points.length);`],
    ['  im.frustumCulled = false;', `  im.computeBoundingSphere();
  im.userData.reviewDetail = {grass: true, full, light, total: points.length,
    center: im.boundingSphere.center, radius: im.boundingSphere.radius};`],
    ['const g = new THREE.IcosahedronGeometry(1, 2);', 'const g = new THREE.IcosahedronGeometry(1, 1);'],
    [`  const im = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach(([m, col], i) => { im.setMatrixAt(i, m); im.setColorAt(i, col); });
  im.castShadow = false; im.receiveShadow = true;
  return im;`, `  const group = new THREE.Group();
  for (const patch of spatialTiles(items, ([m]) => [m.elements[12], m.elements[14]], 10)) {
    const im = new THREE.InstancedMesh(geo, mat, patch.length);
    patch.forEach(([m, col], i) => { im.setMatrixAt(i, m); im.setColorAt(i, col); });
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  return group;`],
  ]);
}

export function optimizeReviewScene(source,metricWorkshop=false) {
  source=replaceSource(source,[
    ['ctx.B.add(material, sculpture, mat(f, x, y - foot - 0.002, z, 0, ry, 0, s, s, s));',
      'ctx.B.figure(material, sculpture, mat(f, x, y - foot - 0.002, z, 0, ry, 0, s, s, s));'],
    ['terrain(M.ground, H, 640, 320)', 'terrain(M.ground, H, 640, 160)'],
    ['terrain(M.ground, H, 640, 300)', 'terrain(M.ground, H, 640, 160)'],
    [`  hall(ctx);
  TEMPLES.forEach(t => temple(ctx, t));
  for (const x of [-7.1, 7.1]) caryatidPorch(ctx, x, -19.9, x < 0 ? 0.36 : -0.36);
  tholos(ctx, -4.6, -10.6);
  fountain(ctx, 4.6, -10.6);`,
      `  const drawBuilding = (name, draw) => {
    const batch = new Batch(M);
    draw({...ctx, B: batch});
    ctx.extra.push(batch.build(name));
  };
  drawBuilding('Atlas', hall);
  for (const t of TEMPLES) drawBuilding(t.id, local => temple(local, t));
  for (const x of [-7.1, 7.1]) {
    drawBuilding('Caryatid porch', local => caryatidPorch(local, x, -19.9, x < 0 ? 0.36 : -0.36));
  }
  drawBuilding('Rotunda', local => tholos(local, -4.6, -10.6));
  drawBuilding('Fountain', local => fountain(local, 4.6, -10.6));`],
  ]);
  return metricWorkshop?replaceSource(source,[
    ['    furnish(ctx, f, rm.id, rm.x);', `    if (rm.id === 'atelier') {
      const z = INNER_Z - 0.22;
      box(B, f, 'bronzeDark', rm.x, 1.28, z, 1.46, 2.56, 0.08);
      for (const side of [-1,1]) for (let tier = 0; tier < 3; tier++) {
        box(B, f, 'bronze', rm.x+side*.36, .45+tier*.79, z+.047, .58, .62, .02);
      }
      obstacle(ctx, f, rm.x, 1.28, z-.30, 1.46, 2.56, 0.08);
    } else furnish(ctx, f, rm.id, rm.x);`],
  ]):source;
}
