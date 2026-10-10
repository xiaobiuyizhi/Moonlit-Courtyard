import * as THREE from 'three';
import {box,cylinder,beam,mesh,curvedTube,mergeStaticMeshes} from './geometry.js';
import {range} from './textures.js';

export function buildArchitecture(scene,textures) {
  const grounds=new THREE.Group();scene.add(grounds);scene=grounds;
  const stone=new THREE.MeshStandardMaterial({color:'#8b9797',map:textures.stone,roughness:.93,bumpMap:textures.stone,bumpScale:.06});
  const darkStone=stone.clone();darkStone.color.set('#57656a');
  const wood=new THREE.MeshStandardMaterial({color:'#895b43',map:textures.wood,roughness:.74,bumpMap:textures.wood,bumpScale:.035});
  const redwood=new THREE.MeshStandardMaterial({color:'#643729',roughness:.68,map:textures.wood});
  const roofMaterial=new THREE.MeshStandardMaterial({color:'#73868a',map:textures.roof,bumpMap:textures.roof,bumpScale:.1,roughness:.66,side:THREE.DoubleSide});
  const tileTrim=new THREE.MeshStandardMaterial({color:'#334a54',roughness:.62});
  const gold=new THREE.MeshStandardMaterial({color:'#a58b53',metalness:.55,roughness:.4});
  const wallMaterial=new THREE.MeshStandardMaterial({color:'#879fa9',map:textures.plaster,roughness:1});
  const materials={stone,darkStone,wood,redwood,roofMaterial,tileTrim,gold,wallMaterial};

  // Pond banks are built above the water plane; its rectangle extends underneath them.
  box(scene,darkStone,[94,.7,44],[0,-.28,-28]);
  box(scene,darkStone,[70,.7,145],[-46,-.28,5]);
  box(scene,darkStone,[70,.7,145],[46,-.28,5]);
  box(scene,darkStone,[94,.7,70],[0,-.28,44]);
  const paving=new THREE.Group();scene.add(paving);
  for(let x=-13;x<14;x+=1.3)for(let z=-12;z<-5.7;z+=1.1){
    const slab=box(paving,stone,[1.24,.09,1.04],[x,.13,z]);slab.rotation.y=range(-.01,.01);
  }
  // A long plaster wall, tiled caps, and circular lattice windows.
  box(scene,wallMaterial,[31,3,.45],[0,1.58,-10.8]);
  box(scene,darkStone,[31,.38,.63],[0,.34,-10.8]);
  box(scene,tileTrim,[31,.17,.77],[0,3.17,-10.8]);
  for(let x=-15;x<=15;x+=.42){
    const cap=cylinder(scene,tileTrim,.095,.095,.82,[x,3.22,-10.8],8);cap.rotation.x=Math.PI/2;
  }
  for(const x of [-11,-5,1,7,13]){
    box(scene,wallMaterial,[.58,3.28,.68],[x,1.68,-10.8]);
    box(scene,tileTrim,[.8,.16,.95],[x,3.39,-10.8]);
  }
  for(const x of [-8,-2,4,10]){
    const back=mesh(scene,new THREE.CircleGeometry(.5,32),tileTrim,[x,1.85,-10.55]);
    const ring=mesh(scene,new THREE.TorusGeometry(.5,.04,8,36),stone,[x,1.85,-10.51]);
    for(let i=-2;i<=2;i++){
      const offset=i*.15,length=Math.sqrt(.45*.45-offset*offset)*2;
      box(scene,darkStone,[.027,length,.035],[x+offset,1.85,-10.49]);
      box(scene,darkStone,[length,.027,.035],[x,1.85+offset,-10.49]);
    }
    back.receiveShadow=false;ring.receiveShadow=false;
  }
  // Pavilion: square hipped roof, upturned corners, visible timber framing.
  const pavilion=new THREE.Group();pavilion.position.set(5.3,0,-3);scene.add(pavilion);
  box(pavilion,stone,[6.1,.4,5.2],[0,.4,0]);
  box(pavilion,darkStone,[5.8,.19,4.95],[0,.66,0]);
  box(pavilion,wood,[5.55,.16,4.7],[0,.81,0]);
  for(const x of [-2.38,2.38])for(const z of [-1.95,1.95]){
    cylinder(pavilion,stone,.24,.28,.3,[x,1,z]);
    cylinder(pavilion,redwood,.13,.16,3.1,[x,2.52,z],16);
    cylinder(pavilion,gold,.16,.16,.055,[x,1.2,z]);
    box(pavilion,redwood,[.34,.32,.34],[x,3.88,z]);
    for(const d of [-1,1])beam(pavilion,redwood,[x,3.36,z],[x+d*.56,3.91,z],.09);
  }
  for(const z of [-1.95,1.95]){
    box(pavilion,redwood,[5.2,.23,.21],[0,3.87,z]);
    box(pavilion,gold,[4.65,.035,.035],[0,3.67,z]);
    for(let x=-2.05;x<2.1;x+=.48){
      box(pavilion,redwood,[.36,.035,.045],[x,3.5,z]);box(pavilion,redwood,[.036,.3,.05],[x-.16,3.57,z]);
    }
  }
  for(const x of [-2.38,2.38])box(pavilion,redwood,[.23,.23,4.1],[x,3.87,0]);
  function railing(a,b){
    beam(pavilion,redwood,[a[0],1.74,a[1]],[b[0],1.74,b[1]],.055);
    beam(pavilion,redwood,[a[0],1.02,a[1]],[b[0],1.02,b[1]],.04);
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let t=0;t<=1;t+=.18/length){const x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t);beam(pavilion,redwood,[x,1.02,z],[x,1.74,z],.021,6);}
  }
  railing([-2.38,-1.95],[2.38,-1.95]);railing([-2.38,-1.95],[-2.38,1.95]);railing([2.38,-1.95],[2.38,1.95]);
  railing([-2.38,1.95],[-.85,1.95]);railing([.85,1.95],[2.38,1.95]);
  box(pavilion,wood,[4.65,.14,.43],[0,1.24,-1.6]);
  for(const x of [-2,2])box(pavilion,wood,[.43,.14,3.4],[x,1.24,0]);
  // Each quadrant is a parametric roof patch rather than a cone.
  const sides=[[[0,0],[-3.22,-2.8],[3.22,-2.8]],[[0,0],[3.22,-2.8],[3.22,2.8]],[[0,0],[3.22,2.8],[-3.22,2.8]],[[0,0],[-3.22,2.8],[-3.22,-2.8]]];
  for(const [,a,b] of sides){
    const positions=[],uvs=[],indices=[],steps=24;
    for(let i=0;i<=steps;i++)for(let j=0;j<=steps;j++){
      const t=i/steps,s=j/steps;const edgeX=THREE.MathUtils.lerp(a[0],b[0],s),edgeZ=THREE.MathUtils.lerp(a[1],b[1],s);
      const corner=Math.pow(Math.abs(s-.5)*2,6);
      const y=5.65-2.05*Math.pow(t,.64)+.49*Math.pow(t,7)+.29*corner*Math.pow(t,5);
      positions.push(edgeX*t,y,edgeZ*t);uvs.push(s*1.45,t);
      if(i<steps&&j<steps){const k=i*(steps+1)+j;indices.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(pavilion,geometry,roofMaterial);
    const edge=[];for(let j=0;j<=16;j++){const s=j/16,corner=Math.pow(Math.abs(s-.5)*2,6);edge.push([THREE.MathUtils.lerp(a[0],b[0],s),4.09+.29*corner,THREE.MathUtils.lerp(a[1],b[1],s)]);}curvedTube(pavilion,tileTrim,edge,.065);
  }
  for(const [x,z] of [[-3.22,-2.8],[3.22,-2.8],[3.22,2.8],[-3.22,2.8]]){
    const points=[];for(let i=0;i<=12;i++){const t=i/12;points.push([x*t,5.68-2.05*Math.pow(t,.64)+.49*Math.pow(t,7)+.29*Math.pow(t,5),z*t]);}
    curvedTube(pavilion,tileTrim,points,.09);
  }
  cylinder(pavilion,gold,.09,.16,.25,[0,5.83,0]);mesh(pavilion,new THREE.SphereGeometry(.14,16,12),tileTrim,[0,6.02,0]);
  mesh(pavilion,new THREE.ConeGeometry(.12,.3,8),gold,[0,6.2,0]);
  // Tea and mooncakes on a carved stone table.
  cylinder(pavilion,stone,.72,.72,.12,[0,1.64,0],48);cylinder(pavilion,stone,.2,.3,.72,[0,1.22,0],16);
  const porcelain=new THREE.MeshStandardMaterial({color:'#c4d2ca',roughness:.28,metalness:.05});
  cylinder(pavilion,porcelain,.24,.25,.035,[.1,1.72,.08],32);
  const cakeMaterial=new THREE.MeshStandardMaterial({color:'#c8994d',roughness:.72});
  for(const [x,z] of [[.03,.02],[.23,.12]]){
    cylinder(pavilion,cakeMaterial,.095,.095,.065,[x,1.77,z],16);mesh(pavilion,new THREE.TorusGeometry(.067,.008,6,20),gold,[x,1.807,z],[Math.PI/2,0,0]);
  }
  mesh(pavilion,new THREE.SphereGeometry(.12,20,12),porcelain,[-.32,1.82,-.1]).scale.set(1,1.1,1);
  cylinder(pavilion,porcelain,.06,.09,.035,[-.32,1.96,-.1]);
  mesh(pavilion,new THREE.TorusGeometry(.07,.016,8,20),porcelain,[-.44,1.83,-.1],[0,Math.PI/2,0]);beam(pavilion,porcelain,[-.22,1.82,-.1],[-.14,1.88,-.1],.025);
  for(const [x,z] of [[-.25,.28],[.36,-.2],[-.55,-.35]])cylinder(pavilion,porcelain,.043,.026,.065,[x,1.76,z],16);
  for(const [x,z] of [[1.25,.55],[-1.25,.65],[0,-1.1]]){cylinder(pavilion,stone,.27,.3,.54,[x,1.15,z],20);cylinder(pavilion,stone,.3,.3,.08,[x,1.45,z],24);}
  // A true stone arch with a hollow underside, voussoirs and carved balustrades.
  const bridge=new THREE.Group();bridge.position.set(-6.7,0,-.9);bridge.rotation.y=-.24;scene.add(bridge);
  const arch=new THREE.Shape();
  const height=x=>.32+1.18*Math.sin((x+3.4)/6.8*Math.PI);
  arch.moveTo(-3.4,.03);arch.lineTo(-3.4,height(-3.4));
  for(let i=1;i<=40;i++){const x=-3.4+6.8*i/40;arch.lineTo(x,height(x));}
  arch.lineTo(3.4,.03);arch.lineTo(2.65,.03);
  for(let i=0;i<=32;i++){const x=2.65-5.3*i/32;arch.lineTo(x,.03+1.06*Math.sqrt(Math.max(0,1-(x/2.65)**2)));}
  arch.lineTo(-3.4,.03);
  mesh(bridge,new THREE.ExtrudeGeometry(arch,{depth:1.85,bevelEnabled:false,curveSegments:32}),stone,[0,0,-.925]);
  for(let i=0;i<26;i++){
    const x=-3.3+i*6.6/25,y=height(x)+.035,angle=Math.atan(1.18*Math.PI/6.8*Math.cos((x+3.4)/6.8*Math.PI));
    box(bridge,stone,[.27,.1,1.94],[x,y,0],[0,0,angle]);
  }
  for(const z of [-.93,.93]){
    const railPoints=[];
    for(let i=0;i<=12;i++){
      const x=-3.3+i*6.6/12,y=height(x);box(bridge,stone,[.17,.71,.17],[x,y+.38,z]);
      cylinder(bridge,stone,.13,.13,.08,[x,y+.79,z],12);mesh(bridge,new THREE.SphereGeometry(.11,12,8),stone,[x,y+.87,z]);
      railPoints.push([x,y+.73,z]);
    }
    curvedTube(bridge,stone,railPoints,.045,48);
    curvedTube(bridge,stone,railPoints.map(([x,y,z])=>[x,y-.39,z]),.035,48);
  }
  for(let i=0;i<16;i++){
    const t=(i+.5)/16*Math.PI,x=Math.cos(t)*2.68,y=Math.sin(t)*1.07;
    for(const z of [-.941,.941])box(bridge,darkStone,[.29,.1,.024],[x,y+.05,z],[0,0,Math.atan2(1.07*Math.cos(t),-2.68*Math.sin(t))]);
  }
  mergeStaticMeshes(pavilion);mergeStaticMeshes(bridge);mergeStaticMeshes(grounds,new Set([pavilion,bridge]));
  return {materials,pavilion,bridge,grounds};
}

export function buildLanterns(scene,pavilion,textures,materials) {
  const lights=[],lanterns=[],glows=[];
  const silk=new THREE.MeshStandardMaterial({color:'#ffd59a',emissive:'#ff9e3e',emissiveIntensity:2.2,roughness:.5});
  const ribs=new THREE.MeshStandardMaterial({color:'#ae5d22',emissive:'#c15d1c',emissiveIntensity:.25,roughness:.7});
  for(const [x,y,z,scale] of [[-2.85,3.3,2.4,1],[2.85,3.3,2.4,1],[-2.85,3.3,-2.4,.85],[2.85,3.3,-2.4,.85],[0,3.15,0,.75]]){
    const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);pavilion.add(group);
    beam(group,materials.gold,[0,.31,0],[0,.83,0],.014);
    const body=mesh(group,new THREE.SphereGeometry(.26,32,20),silk);body.scale.set(1,1.08,1);body.castShadow=false;lanterns.push(group);
    for(let i=0;i<12;i++){
      const theta=i/12*Math.PI*2,points=[];
      for(let j=0;j<=10;j++){const phi=.23+j/10*(Math.PI-.46),r=Math.sin(phi)*.263;points.push([Math.cos(theta)*r,Math.cos(phi)*.28,Math.sin(theta)*r]);}
      const rib=curvedTube(group,ribs,points,.006,12);rib.castShadow=false;
    }
    for(const h of [-.265,.265])cylinder(group,materials.gold,.092,.092,.045,[0,h,0],16);
    beam(group,ribs,[0,-.29,0],[0,-.49,0],.015);
    cylinder(group,ribs,.026,.015,.19,[0,-.55,0],8);
    const light=new THREE.PointLight('#ffb564',30,9,2);light.position.set(0,-.05,0);group.add(light);lights.push(light);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.glow,color:'#ffb668',transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.scale.set(1.9,1.9,1);group.add(sprite);glows.push(sprite);
  }
  const floorLight=new THREE.PointLight('#ffbb77',12,8,2);floorLight.position.set(5.3,2.4,-2.2);scene.add(floorLight);lights.push(floorLight);
  return {lights,lanterns,glows,silk,ribs,baseIntensities:lights.map(light=>light.intensity)};
}
