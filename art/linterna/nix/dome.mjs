import * as T from 'three';

const canopyRadius = 2.72;
const spring = 5.03;
const rise = 2.82;
const slitWidth = .94;
const edge = Math.asin(slitWidth / (2 * canopyRadius));

export const domePlan = {
  gardenCenter: [0,0,.12],
  roomCenter: [0,0,-1.19],
  diameter: 2 * canopyRadius,
  spring,
  crown: spring + rise,
  slitWidth,
};

const form = (side, fold, angle) => new T.Vector3(
  side * canopyRadius * Math.sin(fold),
  spring + rise * Math.cos(fold) * Math.sin(angle),
  canopyRadius * Math.cos(fold) * Math.cos(angle),
);

export function makeDome(center) {
  const dome = new T.Group();
  dome.name = 'WANDA observatory dome';
  dome.userData.feature = 'wanda-observatory-dome';
  dome.position.set(...center);
  const patina = ['#44696a','#527576','#4a6d71'].map(color =>
    new T.MeshStandardMaterial({color, roughness:.68, metalness:.18, side:T.DoubleSide}));
  const bronze = new T.MeshStandardMaterial({color:'#a87e56', roughness:.56, metalness:.37});
  const curb = new T.MeshStandardMaterial({color:'#445952', roughness:.83});
  const seam = new T.MeshStandardMaterial({color:'#708f88', roughness:.63, metalness:.24});
  function add(name,geometry,material) {
    const mesh = new T.Mesh(geometry,material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    dome.add(mesh);
    return mesh;
  }
  function annulus(name, profile, material) {
    add(name,new T.LatheGeometry(profile.map(([radius,y])=>new T.Vector2(radius,y)),64),material);
  }
  annulus('Circular observatory drum', [
    [2.49,3.94],[2.78,3.94],[2.78,5.04],[2.49,5.04],[2.49,3.94],
  ],curb);
  for (const y of [4.72,spring-.054]) {
    annulus('Bronze ring on the observatory drum', [
      [2.76,y-.032],[2.82,y-.032],[2.82,y+.032],[2.76,y+.032],[2.76,y-.032],
    ],bronze);
  }

  function panel(side,low,high,finish) {
    const positions = [], normals = [], triangles = [], meridianSegments = 32, foldSegments = 5;
    for (let i=0;i<=foldSegments;i++) for (let j=0;j<=meridianSegments;j++) {
      const {x,y,z}=form(side,T.MathUtils.lerp(low,high,i/foldSegments),Math.PI*j/meridianSegments);
      positions.push(x,y,z);
      const normal=new T.Vector3(x/canopyRadius**2,(y-spring)/rise**2,z/canopyRadius**2).normalize();
      normals.push(...normal.toArray());
    }
    const stride=meridianSegments+1;
    for (let i=0;i<foldSegments;i++) for (let j=0;j<meridianSegments;j++) {
      const a=i*stride+j,b=a+stride;
      if (side>0) triangles.push(a,b,a+1,b,b+1,a+1);
      else triangles.push(a,a+1,b,b,a+1,b+1);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    geometry.setIndex(triangles);
    add('Patinated copper dome panel',geometry,finish);
  }

  for (const side of [-1,1]) {
    const divisions = 5;
    for (let i=0;i<divisions;i++) {
      const low=T.MathUtils.lerp(edge,Math.PI/2,i/divisions);
      const high=T.MathUtils.lerp(edge,Math.PI/2,(i+1)/divisions);
      panel(side,low,high,patina[i%patina.length]);
      const points=Array.from({length:25},(_,j)=>
        form(side,low,Math.PI*j/24).add(new T.Vector3(0,.022,0)));
      const profile=new T.CatmullRomCurve3(points);
      add(i ? 'Standing copper seam' : 'Bronze observation slit rail',
        new T.TubeGeometry(profile,40,i ? .029 : .056,8,false),i ? seam : bronze);
    }
  }
  return dome;
}
