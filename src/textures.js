import * as THREE from 'three';

export function seededRandom(seed = 3917) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
export const random = seededRandom();
export const range = (min, max) => min + random() * (max - min);

function canvasTexture(size, draw, repeat = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

export function makeTextures() {
  const stone = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#9d9f99'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 23000; i++) {
      const shade = Math.floor(range(85, 200));
      ctx.fillStyle = `rgba(${shade},${shade},${shade - 5},${range(.1, .45)})`;
      ctx.fillRect(range(0, size), range(0, size), range(.5, 2.5), range(.5, 2));
    }
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = '#414e4524'; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(range(0, size), range(0, size));
      ctx.bezierCurveTo(range(0,size),range(0,size),range(0,size),range(0,size),range(0,size),range(0,size));ctx.stroke();
    }
  });
  const wood = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#764c34'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 400; i++) {
      ctx.strokeStyle = random() > .5 ? '#2e170e33' : '#cf986331';ctx.lineWidth=range(.2,1.5);
      const y=range(0,size);ctx.beginPath();ctx.moveTo(0,y);
      for(let x=0;x<=size;x+=8)ctx.lineTo(x,y+Math.sin(x*.03+i)*range(.5,3));ctx.stroke();
    }
    ctx.strokeStyle='#291a14';ctx.lineWidth=3;
    for(let y=0;y<size;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke();}
  });
  const plaster = canvasTexture(128,(ctx,size)=>{
    ctx.fillStyle='#bbc0b5';ctx.fillRect(0,0,size,size);
    for(let i=0;i<8000;i++){ctx.fillStyle=random()>.5?'#69766b18':'#ffffff18';ctx.fillRect(range(0,size),range(0,size),1,1);}
  },3);
  const roof = canvasTexture(256,(ctx,size)=>{
    ctx.fillStyle='#3f5359';ctx.fillRect(0,0,size,size);
    const gradient=ctx.createLinearGradient(0,0,32,0);gradient.addColorStop(0,'#293a43');gradient.addColorStop(.42,'#6a7c80');gradient.addColorStop(.65,'#4d636b');gradient.addColorStop(1,'#24343c');
    for(let x=0;x<size;x+=32){ctx.save();ctx.translate(x,0);ctx.fillStyle=gradient;ctx.fillRect(0,0,32,size);ctx.restore();}
    for(let y=0;y<size;y+=32){ctx.fillStyle='#101b2190';ctx.fillRect(0,y,size,2);ctx.fillStyle='#81929144';ctx.fillRect(0,y+2,size,1);}
    for(let i=0;i<4500;i++){ctx.fillStyle='#b4bba013';ctx.fillRect(range(0,size),range(0,size),2,2);}
  },3);
  const moon=canvasTexture(512,(ctx,size)=>{
    ctx.fillStyle='#eee5cc';ctx.fillRect(0,0,size,size);
    // Overlapping maria and fine craters give the moon a textured, lunar surface.
    for(let i=0;i<68;i++){
      const x=range(0,size),y=range(0,size),r=range(8,90);
      const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#655f5445');g.addColorStop(.65,'#82796920');g.addColorStop(1,'#ada58e00');
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);
    }
    for(let i=0;i<1400;i++){
      const x=range(0,size),y=range(0,size),r=range(.5,7);
      ctx.fillStyle='#fff8df35';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#5b595330';ctx.beginPath();ctx.arc(x-.6,y-.7,r*.8,0,Math.PI*2);ctx.fill();
    }
    for(let i=0;i<30000;i++){ctx.fillStyle=random()>.5?'#ffffff12':'#514d4310';ctx.fillRect(range(0,size),range(0,size),1,1);}
  });
  const normal=canvasTexture(256,(ctx,size)=>{
    const data=ctx.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
      const dx=Math.cos(u*5+Math.sin(v*3))*.28+Math.cos(u*13+v*7)*.12;
      const dy=Math.cos(v*6+Math.sin(u*4))*.28+Math.cos(u*9-v*11)*.12;
      const i=(y*size+x)*4;data.data[i]=128+dx*110;data.data[i+1]=128+dy*110;data.data[i+2]=245;data.data[i+3]=255;
    }ctx.putImageData(data,0,0);
  });normal.colorSpace=THREE.NoColorSpace;
  const glow=canvasTexture(64,(ctx,size)=>{
    const g=ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    g.addColorStop(0,'rgba(255,255,245,1)');g.addColorStop(.1,'rgba(255,245,195,.95)');g.addColorStop(.3,'rgba(255,217,150,.35)');g.addColorStop(1,'rgba(255,210,135,0)');ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
  });
  return {stone,wood,plaster,roof,moon,normal,glow};
}
