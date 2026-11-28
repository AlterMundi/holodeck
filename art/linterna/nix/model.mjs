import * as T from 'three';
import { plan } from './plan.mjs';
import { domePlan, makeDome } from './dome.mjs';

function surface(color, roughness = .74, metalness = 0) {
  return new T.MeshStandardMaterial({color, roughness, metalness});
}

function grain(color, accent, mode) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  let seed = 21732;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 2400; i++) {
    ctx.globalAlpha = (mode === 'wood' ? .19 : .085) * rnd();
    ctx.fillStyle = i % 2 ? accent : '#171719';
    const x = rnd() * 128, y = rnd() * 128;
    ctx.fillRect(x, y, mode === 'wood' ? 4 + 73 * rnd() : 1 + 2 * rnd(), .3 + .75 * rnd());
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return new T.MeshStandardMaterial({map, roughness: .82});
}

function textMaterial(lines, dimensions, {color = '#f2e2bd', background = '#243033', size = 58} = {}) {
  const width = 512;
  const height = Math.ceil(width * dimensions[1] / dimensions[0]);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.floor(height * size / 100)}px Georgia, serif`;
  for (const [i, text] of lines.entries()) {
    ctx.fillText(text, width / 2, height * (i + 1) / (lines.length + 1), width * .93);
  }
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({map, toneMapped: false});
}

export function makeNix({approachLength=6.2}={}) {
  const model = new T.Group();
  model.name = 'Casa Linterna / Templo de Nix';
  model.userData = {units: 'metres', up: '+Y', review: 'design-only'};
  const stone = grain('#c5bda9', '#f8e7c6', 'stone');
  const plaster = grain('#a5a9a0', '#eae0c5', 'stone');
  const walnut = grain('#604431', '#c39459', 'wood');
  const floor = ['#696867', '#777773', '#706e67', '#737472'].map(c => grain(c, '#c4b99d', 'stone'));
  const brass = surface('#b88b50', .30, .52);
  const patina = surface('#4e6461');
  const teal = surface('#203438');
  const iron = surface('#1c252c', .44, .26);
  const dark = surface('#121b23');
  const slate = surface('#3e5156');
  const lamp = new T.MeshBasicMaterial({color: '#fbc588'});
  const shadow = new T.MeshBasicMaterial({color: '#10161d'});
  const pictures = {};
  const markers = {};
  const hitboxes = {};
  const add = (name, geo, material, at, parent = model) => {
    const mesh = new T.Mesh(geo, material);
    mesh.name = name;
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };
  const box = (name, size, at, mat, parent) => add(name, new T.BoxGeometry(...size), mat, at, parent);
  const plane = (name, size, at, mat, parent) => add(name, new T.PlaneGeometry(...size), mat, at, parent);
  const tube = (name, radius, depth, at, mat, parent, angle = Math.PI / 2) => {
    const obj = add(name, new T.CylinderGeometry(radius, radius, depth, 24), mat, at, parent);
    obj.rotation.x = angle;
    return obj;
  };
  const ring = (name, radius, band, at, mat, parent) =>
    add(name, new T.TorusGeometry(radius, band, 7, 48), mat, at, parent);
  const group = (name, at, parent = model) => {
    const object = new T.Group();
    object.position.set(...at);
    object.name = name;
    parent.add(object);
    return object;
  };
  const plaque = (name, text, size, at, parent, options) => {
    box(name + ' / walnut back', [size[0] + .065, size[1] + .047, .04],
      [at[0], at[1], at[2] - .025], walnut, parent);
    return plane(name, size, at, textMaterial(text, size, options), parent);
  };
  const lanterns = [];

  box('Level limestone foundation', [12.3, .14, 12.4], [0, -.077, .03], stone);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      box('Limestone paving', [1.483, .025, 1.483], [-5.25 + col * 1.5, -.013, -5.25 + row * 1.5],
        floor[(row * 3 + col) % 4]);
    }
  }
  box('North limewash wall', [12, 3.68, .28], [0, 1.84, -5.88], plaster);
  for (const x of [-5.88, 5.88]) {
    box('Limewash side wall', [.28, 3.68, 12], [x, 1.84, 0], plaster);
    box('Sage skirting', [.07, .26, 11.45], [Math.sign(x) * 5.70, .13, 0], patina);
    box('Continuous timber cornice', [.17, .18, 11.5], [Math.sign(x) * 5.65, 3.39, 0], walnut);
    const outerX = Math.sign(x) * 6.06;
    box('Outer limestone foot course', [.11,.28,12], [outerX,.14,0], stone);
    box('Outer sage fascia', [.105,.19,12], [outerX,3.50,0], patina);
    for (const bay of [-4.48,-1.49,1.49,4.48]) {
      box('Outer engaged pilaster', [.09,2.96,.24], [outerX,1.76,bay], stone);
      box('Outer walnut pilaster cap', [.11,.16,.37], [outerX,3.30,bay], walnut);
    }
    for (const z of [-5.10, -3.50, 3.95, 5.10]) {
      box('Engaged walnut pier', [.101, 3.28, .18], [Math.sign(x) * 5.70, 1.66, z], walnut);
      box('Pier shoe', [.19, .21, .29], [Math.sign(x) * 5.63, .12, z], stone);
    }
  }
  for (const x of [-3.55, 3.55])
    box('South wall opening segment', [4.90, 3.68, .30], [x, 1.84, 5.88], plaster);
  box('Door lintel fill', [2.20, 1.08, .30], [0, 3.14, 5.88], plaster);
  for (const x of [-1.23, 1.23]) {
    box('Dressed limestone door jamb', [.26, 2.75, .53], [x, 1.375, 5.88], stone);
    box('Walnut reveal', [.07, 2.60, .43], [x * .924, 1.30, 5.88], walnut);
  }
  box('Dressed stone lintel', [2.78, .24, .55], [0, 2.72, 5.88], stone);
  box('Level door seam', [2.2, .024, .48], [0, .009, 5.96], brass);
  box('Entry step-free approach', [3.4, .08, approachLength], [0, -.04, 6.04 + approachLength/2], stone);
  for (const x of [-2.28, 2.28]) {
    box('Portico plinth', [.54, .22, .57], [x, .11, 6.55], stone);
    tube('Portico cedar column', .15, 2.73, [x, 1.57, 6.55], walnut, model, 0);
    box('Portico capital', [.51, .24, .53], [x, 2.96, 6.55], stone);
  }
  box('Portico cornice', [5.3, .27, .60], [0, 3.18, 6.45], stone);
  const pediment = new T.Shape();
  pediment.moveTo(-2.73, 0);
  pediment.lineTo(0, 1.03);
  pediment.lineTo(2.73, 0);
  pediment.closePath();
  add('Limewash pediment', new T.ExtrudeGeometry(pediment, {depth: .49, bevelEnabled: false}),
    plaster, [0, 3.30, 6.15]);
  tube('Amber facade oculus', .172, .045, [0, 3.67, 6.67], lamp);
  ring('Brass oculus pin', .185, .022, [0, 3.67, 6.70], brass);
  plaque('Facade name', ['TEMPLO DE NIX'], [1.6, .24], [0, 3.12, 6.770], model,
    {background: '#242b2d', size: 66});
  const innerSign = group('Return plate', [0, 2.99, 5.69]);
  innerSign.rotation.y = Math.PI;
  plaque('Return text', ['VOLVER AL JARDÍN'], [1.55, .24], [0, 0, 0], innerSign, {size: 57});

  // A low square coffer surrounds an open octagonal lantern. Its opening is architecture.
  const domeZ = domePlan.roomCenter[2];
  const ceiling = new T.Shape();
  ceiling.moveTo(-6, -6); ceiling.lineTo(6, -6); ceiling.lineTo(6, 6); ceiling.lineTo(-6, 6); ceiling.closePath();
  const opening = new T.Path();
  for (let i = 0; i <= 8; i++) {
    const a = i * Math.PI / 4;
    opening[i ? 'lineTo' : 'moveTo'](2.85 * Math.cos(a), -domeZ + 2.85 * Math.sin(a));
  }
  ceiling.holes.push(opening);
  const coffer = add('Coffered cedar ceiling', new T.ExtrudeGeometry(ceiling, {depth: .19, bevelEnabled: false}),
    walnut, [0, 3.56, 0]);
  coffer.rotation.x = -Math.PI / 2;
  function octagonPanel(r1, y1, r2, y2, z, material) {
    for (let i = 0; i < 8; i++) {
      const points = [[r1, y1, i], [r1, y1, i + 1], [r2, y2, i + 1], [r2, y2, i]];
      const vs = points.flatMap(([r, y, n]) => [r * Math.cos(n * Math.PI / 4), y, z - r * Math.sin(n * Math.PI / 4)]);
      const geo = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vs, 3));
      geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
      add('Octagonal lantern carpentry', geo, material, [0, 0, 0]);
    }
  }
  const roofFinish = surface('#4b555a');
  roofFinish.side = T.DoubleSide;
  octagonPanel(2.85, 3.61, 1.52, 4.90, domeZ, roofFinish);
  octagonPanel(2.90, 3.62, 2.85, 3.53, domeZ, brass);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const from = new T.Vector3(2.89 * Math.cos(angle), 3.57, domeZ - 2.89 * Math.sin(angle));
    const to = new T.Vector3(1.5 * Math.cos(angle), 4.90, domeZ - 1.5 * Math.sin(angle));
    const beam = box('Lantern radial cedar rib', [.12, from.distanceTo(to), .12],
      from.clone().lerp(to, .5).toArray(), walnut);
    beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.sub(from).normalize());
  }
  const rim = ring('Open night aperture / bronze rim', 1.51, .065, [0, 4.91, domeZ], brass);
  rim.rotation.x = -Math.PI / 2;
  model.add(makeDome(domePlan.roomCenter));

  // Brass floor witness line and a low side bench clear of the circulation routes.
  for (const x of [-.85, .85])
    box('Flush brass approach line', [.025, .008, 3.44], [x, .002, 3.68], brass);
  const inlay = ring('Observation floor inlay', 1.12, .014, [-1.70, .004, -.86], brass);
  inlay.rotation.x = -Math.PI / 2;
  box('Linen observing bench', [.71, .12, 3.06], [-5.36, .50, -1.40], patina);
  for (const z of [-2.61, -.19])
    box('Bench stone leg', [.53, .43, .28], [-5.36, .22, z], stone);
  box('North log rail', [8.0, .15, .35], [-.07, .97, -5.59], walnut);

  // Tilted instrument body and forward-facing eye relief are intentionally distinct.
  const instrument = group('WANDA instrument sculpture', [-1.70, 0, -.87]);
  tube('Levelling foot', .64, .12, [0, .06, 0], stone, instrument, 0);
  tube('Cast mount pier', .34, .76, [0, .47, 0], iron, instrument, 0);
  tube('Azimuth bearing representation', .40, .15, [0, .88, 0], brass, instrument, 0);
  for (const x of [-.31, .31])
    box('Elevation yoke', [.12, .53, .29], [x, 1.15, -.05], iron, instrument);
  const barrel = group('Inclined optical barrel', [0, 1.55, -.50], instrument);
  barrel.rotation.x = -.39;
  tube('Bronzed telescope tube', .29, 1.38, [0, 0, 0], teal, barrel);
  tube('Front retaining band', .31, .12, [0, 0, -.64], brass, barrel);
  tube('Hood lip', .33, .14, [0, 0, -.78], iron, barrel);
  tube('Recessed lens', .263, .025, [0, 0, -.862], slate, barrel);
  const eyeAt = plan.anchors['wanda.eyepiece'].at;
  const eye = group('WANDA eye relief', eyeAt);
  tube('Eyepiece housing', .485, .22, [0, 0, -.124], iron, eye);
  ring('Eyepiece machined brass ring', .445, .033, [0, 0, .011], brass, eye);
  ring('Mask seating edge', .414, .012, [0, 0, .025], patina, eye);
  const crop = new T.CircleGeometry(.406, 72);
  const uv = crop.attributes.uv;
  // The sampling circle is the height of an undistorted 4:3 frame.
  for (let i = 0; i < uv.count; i++) uv.setX(i, .5 + (uv.getX(i) - .5) * 3 / 4);
  pictures.eyepiece = add('Circular image mask · central crop', crop, shadow, [0, 0, .029], eye);
  hitboxes.eyepiece = pictures.eyepiece;
  plaque('Eyepiece brass tag', ['OCULAR WANDA'], [.98, .158], [0, -.59, .052], eye, {size: 68});

  const console = group('WANDA reading console', [0, 0, -.81]);
  box('Stone console plinth', [.97, .1, .82], [0, .051, 0], stone, console);
  box('Walnut console cabinet', [.86, .84, .59], [0, .50, 0], walnut, console);
  box('Bronze console edge', [.93, .055, .66], [0, .949, .02], brass, console);
  box('Slate console top', [.82, .034, .55], [0, .991, .03], slate, console);
  for (const x of [-.26, .22])
    tube('Inspection dial representation', .087, .075, [x, 1.03, .064], brass, console, 0);
  plaque('Console status caption', ['ESTADO DE WANDA'], [.72, .14], [0, .77, .305], console, {size: 62});
  const displaySize = [.73, .22];
  box('WANDA status display bezel', [.78, .27, .071], [0, 1.14, -.094], brass, console);
  const statusPanel = plane('WANDA status display face', displaySize, [0, 1.14, -.052], shadow, console);
  const statusMaterial = text => textMaterial([text], displaySize, {size: 47});

  const galleryHead = group('Wall exhibition frieze', [5.716, 2.86, -.05]);
  galleryHead.rotation.y = -Math.PI / 2;
  plaque('Wall title', ['CUADERNO DE CIELO'], [3.8, .28], [0, 0, .03], galleryHead, {size: 65});
  const captions = {capture: 'CAPTURA FIJADA · SIMULADA', 'preview-02': 'SECUENCIA DE PRUEBA · +250 MS',
    'preview-03': 'SECUENCIA DE PRUEBA · +500 MS'};
  for (const [id, anchor] of Object.entries(plan.anchors)) {
    if (!anchor.asset) continue;
    const panel = group(id + ' / frame', anchor.at);
    panel.rotation.y = -Math.PI / 2;
    const [w,h] = anchor.size;
    box('Walnut frame profile', [w + .24, h + .24, .104], [0, 0, -.009], walnut, panel);
    box('Brass inner edge', [w + .098, h + .098, .088], [0, 0, .019], brass, panel);
    pictures[anchor.asset] = plane('4:3 thumbnail', [w,h], [0,0,.069], shadow, panel);
    hitboxes[anchor.asset] = pictures[anchor.asset];
    plaque('Observation caption', [captions[anchor.asset]], [w + .09, .166], [0, -h/2 - .212, .067], panel, {size: 55});
    box('Warmed gallery picture light', [.75, .065, .14], [0, h/2 + .19, .08], brass, panel);
    box('Gallery practical strip', [.67, .018, .065], [0, h/2 + .153, .098], lamp, panel);
    const lightAt = new T.Vector3(0, h/2 + .115, .38);
    panel.updateMatrixWorld(true);
    lanterns.push({at: panel.localToWorld(lightAt).toArray(), intensity: 5.0, color: '#ffc878', range: 3.3});
  }

  for (const [x,y,z] of [[-5.45,2.43,-3.85],[-5.45,2.43,3.87],[5.46,2.43,4.3],[-1.83,2.45,6.67],[1.83,2.45,6.67]]) {
    box('Lantern backing', [.24,.40,.20], [x,y,z], brass);
    box('Amber lantern glass', [.158,.28,.19], [x,y+.01,z+.075], lamp);
    for (const ay of [-.17,.18]) box('Lantern brass lid', [.27,.06,.26], [x,y+ay,z+.07], iron);
    lanterns.push({at:[x+(Math.abs(x)>4 ? -.32 * Math.sign(x) : 0),y-.04,z+.32],
      intensity: Math.abs(x) > 4 ? 12.5 : 5.5, color: '#ffc582', range: 5.0});
  }
  for (const [id, descriptor] of Object.entries(plan.anchors)) {
    const anchor = group(id, descriptor.at);
    anchor.userData = {anchorId:id, ...descriptor};
    markers[id] = anchor;
  }
  return {model, pictures, hitboxes, markers, lanterns, shadow, statusPanel, statusMaterial};
}
