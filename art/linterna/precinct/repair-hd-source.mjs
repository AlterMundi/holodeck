import assert from 'node:assert/strict';

export function replaceSource(source,replacements) {
  for (const [from,to] of replacements) {
    const at=source.indexOf(from);
    assert.ok(at>=0&&source.indexOf(from,at+from.length)<0,
      'The HD generator revision changed at: '+from);
    source=source.slice(0,at)+to+source.slice(at+from.length);
  }
  return source;
}

function replaceSection(source,start,end,body) {
  const first=source.indexOf(start);
  const last=source.indexOf(end,first+start.length);
  assert.ok(first>=0&&last>first&&source.indexOf(start,first+start.length)<0,
    'The HD generator revision changed at: '+start);
  return source.slice(0,first)+body+'\n\n'+source.slice(last);
}

export function repairArchitecture(source) {
  source=replaceSource(source,[
    // The front of the shaft must face away from the axis. Seat its open
    // lower ring in the solid collar so both export resolutions keep contact.
    ['idx.push(a, b, a + 1, b, b + 1, a + 1);',
      'idx.push(a, a + 1, b, b, a + 1, b + 1);'],
    ['pts.push([R, 0.66 * r], [R, 0.7 * r], [0, 0.7 * r]);',
      'const collar = 1.075 * r;\n    pts.push([collar, 0.66 * r], [collar, 0.7 * r], [0, 0.7 * r]);'],
    ['const shaftH = h - plinthH - base.height - cap.height;',
      'const seat = plinthH + base.height - 0.04 * r;\n  const shaftH = h - seat - cap.height;'],
    ['flutedShaft(shaftH, r), mat(f, x, plinthH + base.height, z)',
      'flutedShaft(shaftH, r), mat(f, x, seat, z)'],
    ['s.moveTo(-A + 0.25, 0); s.lineTo(0, H - 0.12); s.lineTo(A - 0.25, 0); s.closePath();',
      'const seat = H + 0.12 - 0.08 / Math.cos(slope);\n    s.moveTo(-A, 0); s.lineTo(0, seat); s.lineTo(A, 0); s.closePath();'],
    ["B.add('marble', moulding(prof, hyp + 0.55), mat(sf, sx * A / 2, H / 2 - 0.05, 0.15, 0, 0, -sx * slope));",
      `const trim = moulding(prof, hyp + 0.22);
      const local = mat(null, sx * A / 2, H / 2 - 0.05, 0.15, 0, 0, -sx * slope);
      trim.applyMatrix4(local);
      const pos = trim.getAttribute('position');
      for (let at = 0; at < pos.count; at++) {
        if (sx * pos.getX(at) < 0) pos.setX(at, 0);
      }
      B.add('marble', trim, sf);`],
    ['const slope = Math.atan2(H, A), hyp = Math.hypot(A, H);',
      `const slope = Math.atan2(H, A), hyp = Math.hypot(A, H);
  const deckTop = 0.12 + 0.08 / Math.cos(slope);
  const ridgeRadius = 1.3 * Math.min(1, Math.max(0.54, m / 0.21));`],
    ['acroterion(B, mat(sf, 0, H + 0.2, 0.2)',
      'acroterion(B, mat(sf, 0, H + deckTop + 0.08 * ridgeRadius - 0.025, 0.505)'],
    ['mat(sf, sx * (A - 0.05), 0.25, 0.2)',
      'mat(sf, sx * (A - 0.05), deckTop + 0.05 * H / A - 0.006, 0.505)'],
    ["box(B, rm, 'terracottaPale', 0, 0, 0, hyp + 0.5, 0.16, 2 * D + 0.2);",
      `const deck = new THREE.BoxGeometry(hyp + 0.25, 0.16, 2 * D + 0.2);
    const local = mat(null, sx * A / 2, y0 + H / 2 + 0.12, 0, 0, 0, -sx * slope);
    const pos = deck.getAttribute('position');
    const nearRidge = Array.from({length:pos.count}, (_,i) => sx * pos.getX(i) < 0);
    deck.translate(sx * 0.125, 0, 0).applyMatrix4(local);
    for (let i = 0; i < pos.count; i++) {
      if (!nearRidge[i]) continue;
      pos.setXYZ(i, 0, pos.getY(i) + sx * pos.getX(i) * H / A, pos.getZ(i));
    }
    deck.computeVertexNormals();
    B.add('terracottaPale', deck, f ?? new THREE.Matrix4());`],
    ['new M4().makeTranslation(0, 0.08, 0)), hyp + 0.4, 2 * D + 0.1, sx,',
      'new M4().makeTranslation(sx * 0.095, 0.08, 0)), hyp + 0.13, 2 * D + 0.1,'],
  ]);
  source=replaceSection(source,'  for (let z = -D; z < D; z += 0.42)','const TEGULA',
    `  const ridgeLength = 2 * D + 0.10;
  const sections = Math.ceil(ridgeLength / 0.42);
  const pitch = ridgeLength / sections;
  for (let i = 0; i < sections; i++) {
    const z = -ridgeLength / 2 + (i + 0.5) * pitch;
    B.instance('imbrexRidge', 'terracotta', IMBREX,
      mat(f, 0, y0 + H + deckTop - 0.012, z,
        0, 0, 0, ridgeRadius, ridgeRadius, pitch / 0.5));
  }
}`);
  source=replaceSection(source,'function tiles(B, f, along, across, sx, k = 1)', 'function palmetteShape',
    `function tiles(B, f, along, across, k = 1) {
  const scale = Math.max(0.68, k);
  const rows = Math.ceil(along / (0.44 * scale));
  const cols = Math.ceil(across / (0.33 * scale));
  const run = along / rows, span = across / cols;
  const tint = new THREE.Color();
  for (let j = 0; j < rows; j++) {
    const x = -along / 2 + (j + 0.5) * run;
    for (let i = 0; i < cols; i++) {
      const z = -across / 2 + (i + 0.5) * span;
      const shade = 0.88 + Math.random() * 0.24;
      tint.setRGB(shade, shade * (0.96 + Math.random() * 0.05), shade * 0.96);
      B.instance('tegula', 'terracotta', TEGULA,
        mat(f, x, 0.007 * scale, z, 0, Math.PI / 2, 0,
          span / 0.31, scale, run / 0.52), tint.clone());
      if (i + 1 < cols) {
        B.instance('imbrex', 'terracotta', IMBREX,
          mat(f, x, 0.014 * scale, z + span / 2, 0, Math.PI / 2, 0,
            scale, scale, run / 0.5), tint.clone());
      }
    }
  }
}`);
  return replaceSection(source,'export function skin(', 'export { lathe, mergeVertices }',
    `export function skin(B, f, material, L, H, holes = [], y0 = 0) {
  const top = y0 + H;
  const panel = (a, b, bottom) => {
    if (b <= a || top <= bottom) return;
    B.add(material, new THREE.PlaneGeometry(b - a, top - bottom),
      mat(f, (a + b) / 2, (bottom + top) / 2, 0));
  };
  let left = -L / 2;
  for (const opening of [...holes].sort((a,b) => a.x - b.x)) {
    const a = Math.max(left, Math.min(L / 2, opening.x - opening.w / 2));
    const b = Math.max(a, Math.min(L / 2, opening.x + opening.w / 2));
    panel(left, a, y0);
    panel(a, b, Math.max(y0, opening.h));
    left = b;
  }
  panel(left, L / 2, y0);
}`);
}

export function repairScene(source) {
  source=replaceSource(source,[
    ['const yP = y0 + colH + 0.075 * 3.63;', 'const yP = y0 + colH + r * 3.91 - 0.004;'],
    ["pediment(B, f, a + 0.42, H + 0.02, 1.3, 4.98, r, t.icon);",
      "pediment(B, f, a + 0.42, colH + r * 3.91 - 0.008, 1.3, 4.98, r, t.icon);"],
    ['const H = 4.36, colH = 3.6,', 'const colH = 3.6,'],
  ]);
  source=replaceSection(source,'function entabRect(', 'function scrolls',
    `function entabRect(B, f, x0, x1, z0, z1, y, m, sides = 'nsew', back = 0.9) {
  const strip = (side, x, z, angle, length, left, right) => {
    if (!sides.includes(side)) return;
    const placement = mat(f, x, y, z, 0, angle, 0);
    const half = length / 2;
    entablature({
      add(material, source, matrix) {
        const geo = source.clone().applyMatrix4(matrix);
        const pos = geo.getAttribute('position'), normal = geo.getAttribute('normal');
        for (let i = 0; i < pos.count; i++) {
          const px = pos.getX(i), pz = pos.getZ(i);
          const joined = sides.includes(px < 0 ? left : right);
          if (!joined) continue;
          const width = 1 + pz / half;
          pos.setX(i, px * width);
          const nx = normal.getX(i) / width, ny = normal.getY(i);
          const nz = normal.getZ(i) - nx * px / half;
          const norm = Math.hypot(nx, ny, nz);
          normal.setXYZ(i, nx / norm, ny / norm, nz / norm);
        }
        B.add(material, geo, placement);
        geo.dispose();
      },
    }, new THREE.Matrix4(), length, m, Math.min(back, half * 0.8));
  };
  strip('n', (x0 + x1) / 2, z1, 0, x1 - x0, 'w', 'e');
  strip('s', (x0 + x1) / 2, z0, Math.PI, x1 - x0, 'e', 'w');
  strip('e', x1, (z0 + z1) / 2, Math.PI / 2, z1 - z0, 'n', 's');
  strip('w', x0, (z0 + z1) / 2, -Math.PI / 2, z1 - z0, 's', 'n');
}`);
  return replaceSection(source,'  const islands = [[','  ctx.lights.push({ pos: new V3(0, 1.6, 6.5)',
    `  const terrain = new THREE.RingGeometry(0.37, 1.27, 96, 12).rotateX(-Math.PI / 2);
  const points = terrain.getAttribute('position');
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i);
    const radius = Math.hypot(x, z), angle = Math.atan2(z, x);
    const bank = Math.max(0, Math.sin(Math.PI * (radius - 0.37) / 0.90)) ** 0.65;
    const rough = fbm2(x * 4.6, z * 4.6, 4);
    const coast = 1 + 0.045 * Math.sin(angle * 5) + 0.038 * Math.cos(angle * 9);
    points.setXYZ(i, x * 1.14 * coast, -0.009 + bank * (0.19 + rough * 0.18), z * 0.83 * coast);
  }
  terrain.computeVertexNormals();
  B.add('islands', terrain, mat(f, 0, 1.046, 0));
  for (const [i, angle] of [0.29, 2.22, 4.12, 5.16].entries()) {
    const x = 0.89 * Math.cos(angle), z = 0.65 * Math.sin(angle);
    const bf = mat(f, x, 1.22, z);
    B.add('gold', new THREE.CylinderGeometry(0.006, 0.01, 0.14, 8), mat(bf, 0, 0.13, 0));
    B.add('lampGlass', new THREE.SphereGeometry(0.022, 12, 8), mat(bf, 0, 0.21, 0));
    const tf = mat(bf, 0.065, 0.028, 0.02, 0, i, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      B.add('marbleWhite', new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), mat(tf, sx * 0.03, 0.035, sz * 0.04));
    box(B, tf, 'marbleWhite', 0, 0.075, 0, 0.08, 0.012, 0.1);
    B.add('terracotta', new THREE.ConeGeometry(0.06, 0.03, 4).rotateY(Math.PI / 4).scale(0.9, 1, 1.2), mat(tf, 0, 0.096, 0));
  }`);
}
