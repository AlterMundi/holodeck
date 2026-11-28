// Average colours of a JPEG at 1/8 resolution from its DC coefficients only.
// Handles baseline (SOF0/SOF1) and the first DC scan of progressive (SOF2)
// files; no inverse DCT is needed for an icon colour grid. Returns linear RGB
// in a GRID x GRID array, or null for unsupported files.
const ZIG=64;

function buildHuffman(lengths,values){
  const codes=new Map();let code=0,k=0;
  for(let len=1;len<=16;len++){
    for(let i=0;i<lengths[len-1];i++)codes.set(len+':'+code++,values[k++]);
    code<<=1;
  }
  return codes;
}

export function jpegGrid(bytes,GRID=32){
  if(bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  const quant=[],dc=[],ac=[];let frame=null,at=2,restart=0,progressive=false;
  while(at<bytes.length){
    if(bytes[at]!==0xff){at++;continue;}
    const marker=bytes[at+1];at+=2;
    if(marker===0xd8||(marker>=0xd0&&marker<=0xd7)||marker===0x01)continue;
    if(marker===0xd9)break;
    const length=bytes.readUInt16BE(at),seg=bytes.subarray(at+2,at+length);
    if(marker===0xdb){
      for(let p=0;p<seg.length;){const pq=seg[p]>>4,tq=seg[p]&15;quant[tq]=pq?seg.readUInt16BE(p+1):seg[p+1];p+=1+(pq?128:64);}
    }else if(marker===0xc4){
      for(let p=0;p<seg.length;){
        const tc=seg[p]>>4,th=seg[p]&15,lengths=[...seg.subarray(p+1,p+17)],n=lengths.reduce((a,b)=>a+b,0);
        (tc?ac:dc)[th]=buildHuffman(lengths,[...seg.subarray(p+17,p+17+n)]);p+=17+n;
      }
    }else if(marker===0xc0||marker===0xc1||marker===0xc2){
      progressive=marker===0xc2;
      const height=seg.readUInt16BE(1),width=seg.readUInt16BE(3),count=seg[5],components=[];
      for(let i=0;i<count;i++)components.push({id:seg[6+i*3],h:seg[7+i*3]>>4,v:seg[7+i*3]&15,q:seg[8+i*3]});
      frame={width,height,components};
      frame.hmax=Math.max(...components.map(c=>c.h));frame.vmax=Math.max(...components.map(c=>c.v));
      frame.mcux=Math.ceil(width/(8*frame.hmax));frame.mcuy=Math.ceil(height/(8*frame.vmax));
      for(const c of components){c.bw=frame.mcux*c.h;c.bh=frame.mcuy*c.v;c.dc=new Float32Array(c.bw*c.bh);}
    }else if(marker===0xc3||marker>=0xc5&&marker<=0xcf&&marker!==0xc8&&marker!==0xcc){
      return null;                                   // lossless / arithmetic
    }else if(marker===0xdd){
      restart=seg.readUInt16BE(0);
    }else if(marker===0xda){
      if(!frame)return null;
      const n=seg[0],scan=[];
      for(let i=0;i<n;i++){const c=frame.components.find(x=>x.id===seg[1+i*2]);c.td=seg[2+i*2]>>4;c.ta=seg[2+i*2]&15;scan.push(c);}
      const ss=seg[1+n*2],se=seg[2+n*2],ah=seg[3+n*2]>>4,al=seg[3+n*2]&15;
      let p=at+length;
      if(progressive&&!(ss===0&&ah===0)){
        // skip refinement/AC scans: find next marker
        while(p<bytes.length&&!(bytes[p]===0xff&&bytes[p+1]!==0&&!(bytes[p+1]>=0xd0&&bytes[p+1]<=0xd7)))p++;
        at=p;continue;
      }
      // bit reader over entropy-coded data
      let bit=0,cur=0;
      const readBit=()=>{
        if(bit===0){
          if(p>=bytes.length)throw Error('eof');
          cur=bytes[p++];
          if(cur===0xff){const next=bytes[p];if(next===0)p++;else if(next>=0xd0&&next<=0xd7){/* marker inside */}}
          bit=8;
        }
        bit--;return (cur>>bit)&1;
      };
      const decode=table=>{let code=0;for(let len=1;len<=16;len++){code=(code<<1)|readBit();const v=table.get(len+':'+code);if(v!==undefined)return v;}throw Error('huffman');};
      const receive=s=>{let v=0;for(let i=0;i<s;i++)v=(v<<1)|readBit();return v<1<<(s-1)?v-(1<<s)+1:v;};
      const pred=new Map(scan.map(c=>[c,0]));
      const block=(c,bx,by)=>{
        const s=decode(dc[c.td]);const diff=s?receive(s):0;
        const value=pred.get(c)+diff;pred.set(c,value);
        if(by<c.bh&&bx<c.bw)c.dc[by*c.bw+bx]=(value<<al)*(quant[c.q]?.[0]??1);
        if(progressive)return;
        for(let k=1;k<ZIG;){const rs=decode(ac[c.ta]);const r=rs>>4,s2=rs&15;if(!s2){if(r===15){k+=16;continue;}break;}k+=r;receive(s2);k++;}
      };
      const single=scan.length===1;
      const units=single?Math.ceil(frame.width*scan[0].h/frame.hmax/8)*Math.ceil(frame.height*scan[0].v/frame.vmax/8):frame.mcux*frame.mcuy;
      const perRow=single?Math.ceil(frame.width*scan[0].h/frame.hmax/8):frame.mcux;
      try{
        for(let u=0;u<units;u++){
          if(restart&&u&&u%restart===0){
            bit=0;while(p<bytes.length&&!(bytes[p]===0xff&&bytes[p+1]>=0xd0&&bytes[p+1]<=0xd7))p++;p+=2;
            for(const c of scan)pred.set(c,0);
          }
          if(single){const c=scan[0];block(c,u%perRow,Math.floor(u/perRow));}
          else{const mx=u%perRow,my=Math.floor(u/perRow);for(const c of scan)for(let v=0;v<c.v;v++)for(let h=0;h<c.h;h++)block(c,mx*c.h+h,my*c.v+v);}
        }
      }catch{ /* keep what was decoded */ }
      while(p<bytes.length&&!(bytes[p]===0xff&&bytes[p+1]!==0&&!(bytes[p+1]>=0xd0&&bytes[p+1]<=0xd7)))p++;
      at=p;
      if(!progressive)break;
      continue;
    }
    at+=length;
  }
  if(!frame)return null;
  const [Y,Cb,Cr]=frame.components;
  const sample=(c,x,y)=>c?c.dc[Math.min(c.bh-1,Math.floor(y*c.bh))*c.bw+Math.min(c.bw-1,Math.floor(x*c.bw))]/8+128:128;
  const grid=new Float32Array(GRID*GRID*3);
  for(let gy=0;gy<GRID;gy++)for(let gx=0;gx<GRID;gx++){
    // glTF texture v runs top-down like JPEG rows (same as pngGrid)
    const x=(gx+.5)/GRID,y=(gy+.5)/GRID;
    const yy=sample(Y,x,y),cb=Cb?sample(Cb,x,y)-128:0,cr=Cr?sample(Cr,x,y)-128:0;
    const rgb=[yy+1.402*cr,yy-.344136*cb-.714136*cr,yy+1.772*cb];
    for(let k=0;k<3;k++)grid[(gy*GRID+gx)*3+k]=(Math.max(0,Math.min(255,rgb[k]))/255)**2.2;
  }
  return grid;
}
