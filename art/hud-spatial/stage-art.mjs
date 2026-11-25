import * as T from 'three';

const {Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Float32BufferAttribute,
  BufferGeometry, LineBasicMaterial, LineLoop, LineSegments, Vector3, Color,
  TorusGeometry, CylinderGeometry, SphereGeometry, OctahedronGeometry, PlaneGeometry,
  BoxGeometry, LatheGeometry, Vector2, ShaderMaterial, AdditiveBlending, DoubleSide} = T;
const tau = 2 * Math.PI;

const solid = (color, roughness=.48) => new MeshStandardMaterial({color,roughness,metalness:.28});
const light = color => new MeshBasicMaterial({color});
function mesh(parent, geometry, material, x=0, y=0, z=0) {
  const model = new Mesh(geometry,material);
  model.position.set(x,y,z);
  parent.add(model);
  return model;
}
function ring(parent, radius, color, {opacity=.7, start=0, length=tau}={}) {
  const vertices=Array.from({length:97},(_,i)=>{
    const angle=start+length*i/96;
    return new Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,0);
  });
  const geom=new BufferGeometry().setFromPoints(vertices);
  const material=new LineBasicMaterial({color,opacity,transparent:true,depthWrite:false});
  const line=length===tau?new LineLoop(geom,material):new T.Line(geom,material);
  parent.add(line);
  return line;
}
function halo(parent, color, size, opacity=.38) {
  const material = new ShaderMaterial({
    transparent:true, blending:AdditiveBlending, depthWrite:false,
    uniforms:{color:{value:new Color(color)},opacity:{value:opacity}},
    vertexShader:'varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 st;uniform vec3 color;uniform float opacity;void main(){float r=length((st-.5)*2.);float a=pow(max(1.-r,0.),2.3);gl_FragColor=vec4(color*a,opacity*a*.65);}'
  });
  return mesh(parent,new PlaneGeometry(size,size),material);
}
function ticks(group,radius,color,count=72) {
  const coords=[];
  for(let i=0;i<count;i++){
    const angle=tau*i/count, end=radius+(i%6===0?.11:.033);
    coords.push(radius*Math.cos(angle),radius*Math.sin(angle),0,end*Math.cos(angle),end*Math.sin(angle),0);
  }
  const geom=new BufferGeometry();
  geom.setAttribute('position',new Float32BufferAttribute(coords,3));
  group.add(new LineSegments(geom,new LineBasicMaterial({color,transparent:true,depthWrite:false,opacity:.54})));
}
function plateGeometry(radius,tube) {
  const geometry=new TorusGeometry(radius,tube,36,180);
  const positions=geometry.attributes.position, colors=[];
  const tint=new Color();
  for(let i=0;i<positions.count;i++){
    const angle=Math.atan2(positions.getY(i),positions.getX(i));
    const relief=(Math.sin(angle*7+.8)+Math.sin(angle*17-1.6)+Math.sin(angle*43))*.025;
    const belt=Math.sin(angle*3+positions.getZ(i)*14)+Math.sin(angle*13)*.24;
    positions.setZ(i,positions.getZ(i)*(1+relief*4));
    tint.set(belt>.48?'#c0e18c':belt>-.15?'#4bae9e':belt>-.7?'#327486':'#624f97');
    tint.multiplyScalar(.78+.22*Math.sin(angle*19+positions.getZ(i)*18)**2);
    colors.push(tint.r,tint.g,tint.b);
  }
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

function orbit() {
  const root=new Group(), diagram=new Group(), decoration=new Group();
  root.add(decoration,diagram);
  const glow=halo(decoration,'#6da6ff',8,.46);
  glow.position.z=-.82;
  ring(decoration,2.18,'#b7f9da',{opacity:.4});
  ring(decoration,2.3,'#95bdb4',{opacity:.28});
  ticks(decoration,2.22,'#dff9b9');
  mesh(diagram,plateGeometry(1.48,.37),new MeshStandardMaterial({vertexColors:true,roughness:.67,metalness:.32}));
  const grooves=[-1,-.6,-.25,.25,.6,1].map(angle=>{
    const track=ring(diagram,1.48+Math.cos(angle)*.38,'#bdfcc9',{opacity:.21});
    track.position.z=Math.sin(angle)*.38;
    return track;
  });
  const route=ring(diagram,1.75,'#ffdfa5',{start:.46,length:1.44});
  route.position.z=.39;
  const nodes=[.46,1.16,1.9].map(angle=>mesh(diagram,new OctahedronGeometry(.09),light('#fff2b1'),1.75*Math.cos(angle),1.75*Math.sin(angle),.39));
  const cursor=halo(diagram,'#fff4ae',1,.65);
  return {root,update({yaw, pitch, step,fx}){
    decoration.rotation.z=-yaw*.4; diagram.rotation.set(.59+pitch,-.17+yaw*.56,-.20+yaw*.22);
    nodes.forEach((node,i)=>node.scale.setScalar(i===step?1.8:.75));
    cursor.position.copy(nodes[step].position); cursor.visible=glow.visible=fx;
    grooves.forEach(track=>track.visible=true);
  }};
}

function threshold(refresh) {
  const root=new Group(), spaces=new Group(), overlays=new Group();
  root.add(spaces,overlays);
  const glow=halo(overlays,'#eb79d7',8,.49);
  glow.position.z=-1.36;
  const panes=[];
  for(let i=0;i<3;i++){
    const p=new Group();
    spaces.add(p);
    const geometry=new PlaneGeometry(1.67,2.42);
    const tint=['#ff9c96','#cca5fa','#adfff2'][i];
    mesh(p,geometry,new MeshBasicMaterial({color:tint,transparent:true,opacity:.14,side:DoubleSide,forceSinglePass:true,depthWrite:false}));
    const edges=new T.LineSegments(new T.EdgesGeometry(geometry),new LineBasicMaterial({color:tint,transparent:true,opacity:.83,depthWrite:false}));
    p.add(edges);
    for(const side of [-1,1]){
      mesh(p,new BoxGeometry(.074,.63,.12),solid(tint),side*.83,-.91,.045);
      mesh(p,new BoxGeometry(.17,.21,.18),solid(tint),side*.83,-1.27,.045);
    }
    const field=new T.TextureLoader().load(['world-day.webp','matter.webp','world-night.webp'][i],refresh);
    field.colorSpace=T.SRGBColorSpace;
    const glass=mesh(p,new PlaneGeometry(1.46,1.71),new MeshBasicMaterial({color:tint,map:field,transparent:true,
      side:DoubleSide,forceSinglePass:true,depthWrite:false,opacity:.30}),0,-.03,.026);
    const sigil=mesh(p,new OctahedronGeometry(.27,0),new MeshBasicMaterial({color:tint,transparent:true,opacity:.85,wireframe:true}),0,.12,.09);
    panes.push({p,sigil,glass});
  }
  ring(overlays,1.77,'#e5b1ff',{opacity:.6}).rotateX(-1.14).position.y=-1.24;
  ring(overlays,2.16,'#ffc98e',{opacity:.42}).rotateX(-1.14).position.y=-1.24;
  return {root,update({yaw,pitch,step,fx,time,motion}){
    spaces.rotation.set(pitch,.23+yaw,0);
    panes.forEach(({p,sigil,glass},i)=>{
      const d=i-step;
      p.position.set(d*1.21,Math.abs(d)*.12,-Math.abs(d)*.64);
      p.rotation.y=d*-.41;
      p.children[0].material.opacity=d===0?.15:.08;
      glass.material.opacity=d===0?.72:.13;
      sigil.rotation.y=motion?time*.42:.46;
    });
    glow.visible=fx;
  }};
}

function pulse() {
  const root=new Group(), scope=new Group(), sample=new Group();
  root.add(scope,sample);
  const glow=halo(scope,'#fc5073',8,.5); glow.position.z=-1;
  ticks(scope,2.03,'#ff9f9e',96);
  ring(scope,1.86,'#ffb893',{opacity:.48});
  ring(scope,1.48,'#b093ff',{opacity:.37});
  for(let i=0;i<4;i++) ring(scope,2.19,'#ffcfa6',{start:i*Math.PI/2+.14,length:.83,opacity:.86});
  const rock = new T.IcosahedronGeometry(1.18,3);
  const v=rock.attributes.position, palette=['#ffa083','#a672df','#afbad6','#c1486b'].map(s=>new Color(s)), colors=[];
  for(let i=0;i<v.count;i++){
    const x=v.getX(i),y=v.getY(i),z=v.getZ(i);
    const factor=1+Math.sin(x*12.5+y*7)*.075+Math.sin(z*17-y*5)*.068;
    v.setXYZ(i,x*factor,y*factor,z*factor);
    const color=palette[Math.floor(Math.abs(Math.sin(y*13+x*3+z*.54))*palette.length)%palette.length];
    colors.push(color.r,color.g,color.b);
  }
  rock.setAttribute('color',new Float32BufferAttribute(colors,3));rock.computeVertexNormals();
  const body=mesh(sample,rock,new MeshStandardMaterial({vertexColors:true,roughness:.59,metalness:.39,flatShading:true,transparent:true}));
  const cage=mesh(sample,new T.IcosahedronGeometry(1.14,1),new MeshBasicMaterial({color:'#ffdec4',wireframe:true,transparent:true,opacity:.66}));
  const scanning=new Group(); scope.add(scanning);
  const plane=mesh(scanning,new T.CircleGeometry(1.39,64),new MeshBasicMaterial({color:'#ff9f98',transparent:true,opacity:.13,side:DoubleSide,depthWrite:false}));
  plane.rotation.x=-Math.PI/2;
  ring(scanning,1.39,'#ffc1a5',{opacity:.9}).rotateX(-Math.PI/2);
  let spin=0;
  return {root,update({yaw,pitch,step,fx,time,motion,dt}){
    if(motion&&step===1)spin+=dt*.37;
    sample.rotation.set(.26+pitch,-.32+yaw+spin,-.16);
    scope.rotation.x=.35+pitch*.28;
    body.material.opacity=step===0?1:.23;
    body.material.depthWrite=step===0;
    cage.visible=step!==0; scanning.visible=step===1;
    scanning.position.y=motion?Math.sin(time*2.1)*.89:0;
    plane.material.opacity=.105+(scanning.position.y+.9)*.039;
    glow.visible=fx;
  }};
}

function strata() {
  const root=new Group(), assembly=new Group(), base=new Group();
  root.add(base,assembly);
  const glow=halo(base,'#3bd8b6',7.5,.43);glow.position.z=-1.05;
  for(const rad of [1.43,1.57,1.84]){
    const line=ring(base,rad,'#b4f5dc',{opacity:rad===1.57?.75:.4});
    line.rotation.x=-1.16;line.position.y=-1.44;
  }
  const lathe=(points,color) => mesh(assembly,new LatheGeometry(points.map(p=>new Vector2(...p)),64),solid(color));
  const lower=lathe([[0,-.2],[.85,-.2],[1.05,-.12],[1.05,.18],[.97,.28],[.66,.28],[.6,.16],[0,.16]],'#587879');
  const inner=lathe([[0,-.28],[.53,-.28],[.51,-.03],[.61,.14],[.47,.21],[.55,.34],[.43,.45],[.43,.54],[0,.54]],'#ffbf87');
  const collar=lathe([[.56,-.12],[.72,-.12],[.86,-.03],[.86,.21],[.75,.27],[.57,.27],[.56,-.12]],'#6ddcc6');
  const crown=lathe([[0,-.1],[.68,-.1],[.93,0],[.99,.1],[.95,.33],[.80,.43],[0,.43]],'#dce9bb');
  const screws=[];
  for(let i=0;i<6;i++){
    const a=tau*i/6;
    screws.push(mesh(assembly,new CylinderGeometry(.069,.069,.075,6),solid('#f8b770'),.81*Math.cos(a),.29,.81*Math.sin(a)));
  }
  const guide=new Group();
  ring(guide,1.03,'#a2ffe3',{opacity:.71}).rotateX(-Math.PI/2);
  assembly.add(guide);
  return {root,update({yaw,pitch,amount,fx}){
    assembly.rotation.set(.31+pitch,.35+yaw,-.15);
    const t=amount/100;
    lower.position.y=-.66-t*.62; inner.position.y=-.24-t*.24; collar.position.y=.31+t*.29; crown.position.y=.76+t*.57;
    guide.position.y=.41+t*.67;
    screws.forEach(s=>s.position.y=lower.position.y+.34);
    guide.visible=t>.2; glow.visible=fx;
  }};
}
export const instruments={orbita:orbit,umbral:threshold,pulso:pulse,estratos:strata};
