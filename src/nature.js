import * as THREE from 'three';
import {beam,mesh,cylinder} from './geometry.js';
import {range,random} from './textures.js';

export function buildNature(scene,textures,materials) {
  const rockMaterial=materials.stone.clone();rockMaterial.color.set('#697b7c');
  const rockGeometry=new THREE.IcosahedronGeometry(1,1);
  const rocks=new THREE.InstancedMesh(rockGeometry,rockMaterial,118);
  rocks.castShadow=true;rocks.receiveShadow=true;const dummy=new THREE.Object3D();
  for(let i=0;i<118;i++){
    let x,z,s;
    if(i<54){x=-11.3+i*22.6/53;z=8.8+Math.sin(x*.28)*.4;s=range(.32,.65);}
    else if(i<94){const side=i%2?1:-1;x=side*(10.6+Math.sin(i)*.35);z=range(-6,9);s=range(.3,.7);}
    else{x=range(-11,11);z=range(-6.7,-5.9);s=range(.3,.65);}
    dummy.position.set(x,s*.3,z);dummy.rotation.set(range(-.3,.3),range(0,6.28),range(-.3,.3));dummy.scale.set(s*1.55,s*.8,s);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }scene.add(rocks);
  for(const [x,z,s] of [[-7.2,10.1,1.25],[7.8,9.8,1.45],[-11,-4,1.1],[10.2,-4.5,1.35]]){
    const rock=mesh(scene,new THREE.IcosahedronGeometry(s,2),rockMaterial,[x,s*.33,z],[range(0,1),range(0,3),range(0,1)]);rock.scale.set(1.6,.7,1);
  }
  // Osmanthus foliage uses instancing, avoiding thousands of separate draw calls.
  const tree=new THREE.Group();tree.position.set(-2.15,.2,-7.3);tree.scale.set(1.12,1.12,1.12);scene.add(tree);
  const bark=new THREE.MeshStandardMaterial({color:'#675a44',map:textures.wood,roughness:1,bumpMap:textures.wood,bumpScale:.15});
  beam(tree,bark,[0,0,0],[.16,2.1,.1],.25,12);beam(tree,bark,[.16,1.9,.1],[-.23,3.6,.02],.17,10);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;beam(tree,bark,[0,.06,0],[Math.cos(a)*.65,.015,Math.sin(a)*.55],.11,6);}
  const clusters=[[-1.55,3.8,.15,1.35],[1.38,4.1,.3,1.4],[-.55,5.0,-.25,1.4],[.6,5.3,.05,1.15],[.1,3.7,1,1.2],[-.7,4.5,-1.1,1.15],[1.7,4.7,-.75,.85]];
  for(const [x,y,z]of clusters){beam(tree,bark,[.06,2.3,0],[x*.64,y*.79,z*.64],.1,8);beam(tree,bark,[x*.64,y*.79,z*.64],[x,y,z],.047,6);
    for(let i=0;i<4;i++)beam(tree,bark,[x*.8,y*.9,z*.8],[x+range(-.6,.6),y+range(-.2,.5),z+range(-.6,.6)],.024,5);
  }
  const leafShape=new THREE.Shape();leafShape.moveTo(0,-.6);leafShape.quadraticCurveTo(.38,-.1,0,.6);leafShape.quadraticCurveTo(-.38,-.1,0,-.6);
  const leafGeometry=new THREE.ShapeGeometry(leafShape,4);const leafMaterial=new THREE.MeshStandardMaterial({color:'#64875a',side:THREE.DoubleSide,roughness:.86});
  const leaves=new THREE.InstancedMesh(leafGeometry,leafMaterial,3100);leaves.receiveShadow=true;
  const leafColor=new THREE.Color();
  for(let i=0;i<3100;i++){
    const [x,y,z,r]=clusters[i%clusters.length];const a=range(0,Math.PI*2),b=Math.acos(range(-1,1)),d=Math.cbrt(random())*r;
    dummy.position.set(x+Math.cos(a)*Math.sin(b)*d,y+Math.cos(b)*d*.72,z+Math.sin(a)*Math.sin(b)*d);
    dummy.rotation.set(range(0,Math.PI),range(0,Math.PI*2),range(0,Math.PI*2));dummy.scale.set(range(.15,.26),range(.21,.35),1);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leafColor.setHSL(range(.19,.28),range(.2,.4),range(.18,.36));leaves.setColorAt(i,leafColor);
  }tree.add(leaves);
  const blossomMaterial=new THREE.MeshStandardMaterial({color:'#edc882',emissive:'#d69e45',emissiveIntensity:.14,roughness:.85});
  const blossoms=new THREE.InstancedMesh(new THREE.SphereGeometry(.026,5,4),blossomMaterial,1200);
  for(let i=0;i<1200;i++){
    const [x,y,z,r]=clusters[i%clusters.length],a=range(0,6.28),b=Math.acos(range(-1,1)),d=range(.6,1)*r;
    dummy.position.set(x+Math.cos(a)*Math.sin(b)*d,y+Math.cos(b)*d*.72,z+Math.sin(a)*Math.sin(b)*d);dummy.rotation.set(0,0,0);dummy.scale.setScalar(range(.8,1.4));dummy.updateMatrix();blossoms.setMatrixAt(i,dummy.matrix);
  }tree.add(blossoms);
  // A small, reusable leaf pool keeps a tap inexpensive, even on phones.
  // It lives in world space, so detached leaves no longer follow the swaying tree.
  const fallingLeafMaterial=leafMaterial.clone();fallingLeafMaterial.color.set('#ffffff');
  const fallingLeaves=new THREE.InstancedMesh(leafGeometry,fallingLeafMaterial,72);
  fallingLeaves.name='falling-osmanthus-leaves';fallingLeaves.count=0;fallingLeaves.visible=false;
  fallingLeaves.frustumCulled=false;fallingLeaves.userData.interactionEffect=true;
  fallingLeaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(fallingLeaves);
  const leafPool=Array.from({length:72},()=>({
    position:new THREE.Vector3(),velocity:new THREE.Vector3(),rotation:new THREE.Euler(),
    spin:new THREE.Vector3(),color:new THREE.Color(),width:0,height:0,born:0,phase:0,landedAt:null,
  }));
  const activeLeaves=[],freeLeaves=[...leafPool],swayImpulses=[];
  const restRotation=tree.rotation.clone(),localHit=new THREE.Vector3(),spawnPosition=new THREE.Vector3();
  let lastSwayTime=-Infinity,treeIsMoving=false,interactionsDisposed=false;

  function sway(time,hitPoint,quality='high',reducedMotion=false){
    if(interactionsDisposed||!Number.isFinite(time)||time-lastSwayTime<.42)return false;
    lastSwayTime=time;tree.updateMatrixWorld(true);
    const nearHit=!!hitPoint?.isVector3;
    if(nearHit){localHit.copy(hitPoint);tree.worldToLocal(localHit);}
    const direction=nearHit?Math.atan2(localHit.z,localHit.x):range(0,Math.PI*2);
    const strength=reducedMotion?.008:.035;
    swayImpulses.push({born:time,duration:reducedMotion?1.5:3.25,x:Math.sin(direction)*strength,z:-Math.cos(direction)*strength});
    if(swayImpulses.length>8)swayImpulses.shift();
    treeIsMoving=true;
    const quantity=reducedMotion?3:quality==='low'?8:quality==='balanced'?13:20;
    for(let i=0;i<quantity&&freeLeaves.length;i++){
      const leaf=freeLeaves.pop();
      if(nearHit&&i<quantity*.65){
        spawnPosition.copy(localHit);spawnPosition.x+=range(-.55,.55);
        spawnPosition.y=THREE.MathUtils.clamp(spawnPosition.y+range(-.22,.4),2.7,6.2);spawnPosition.z+=range(-.55,.55);
      }else{
        const [x,y,z,r]=clusters[Math.floor(random()*clusters.length)];
        const a=range(0,Math.PI*2),b=Math.acos(range(-1,1)),d=Math.cbrt(random())*r;
        spawnPosition.set(x+Math.cos(a)*Math.sin(b)*d,y+Math.cos(b)*d*.72,z+Math.sin(a)*Math.sin(b)*d);
      }
      leaf.position.copy(spawnPosition);tree.localToWorld(leaf.position);
      leaf.velocity.set(range(-.32,.32),range(-.25,.08),range(-.25,.25));
      leaf.rotation.set(range(-Math.PI,Math.PI),range(0,Math.PI*2),range(0,Math.PI*2));
      leaf.spin.set(range(-1.8,1.8),range(-1.3,1.3),range(-2.1,2.1));
      if(reducedMotion)leaf.spin.multiplyScalar(.25);
      leaf.width=range(.17,.25);leaf.height=range(.23,.34);leaf.born=time;leaf.phase=range(0,Math.PI*2);leaf.landedAt=null;
      leaf.color.setHSL(range(.19,.26),range(.35,.5),range(.3,.47));activeLeaves.push(leaf);
      dummy.position.copy(leaf.position);dummy.rotation.copy(leaf.rotation);dummy.scale.set(leaf.width,leaf.height,1);dummy.updateMatrix();
      fallingLeaves.setMatrixAt(activeLeaves.length-1,dummy.matrix);fallingLeaves.setColorAt(activeLeaves.length-1,leaf.color);
    }
    fallingLeaves.count=activeLeaves.length;fallingLeaves.visible=activeLeaves.length>0;
    if(activeLeaves.length){fallingLeaves.instanceMatrix.needsUpdate=true;fallingLeaves.instanceColor.needsUpdate=true;}
    return true;
  }

  function update(time,delta){
    if(interactionsDisposed)return;
    if(treeIsMoving){
      let x=0,z=0;
      for(let i=swayImpulses.length-1;i>=0;i--){
        const impulse=swayImpulses[i],age=Math.max(0,time-impulse.born);
        if(age>=impulse.duration){swayImpulses.splice(i,1);continue;}
        const wave=Math.sin(age*9.5)*Math.pow(1-age/impulse.duration,1.8);
        x+=impulse.x*wave;z+=impulse.z*wave;
      }
      tree.rotation.x=restRotation.x+THREE.MathUtils.clamp(x,-.065,.065);
      tree.rotation.z=restRotation.z+THREE.MathUtils.clamp(z,-.065,.065);
      tree.updateMatrixWorld(true);treeIsMoving=swayImpulses.length>0;
    }
    if(!activeLeaves.length)return;
    const step=THREE.MathUtils.clamp(delta||0,0,.05);
    for(let i=activeLeaves.length-1;i>=0;i--){
      const leaf=activeLeaves[i],age=Math.max(0,time-leaf.born);
      if(age>9||(leaf.landedAt!==null&&time-leaf.landedAt>1.15)){
        freeLeaves.push(leaf);activeLeaves[i]=activeLeaves[activeLeaves.length-1];activeLeaves.pop();continue;
      }
      if(leaf.landedAt===null){
        leaf.velocity.y=Math.max(-1.45,leaf.velocity.y-step*.62);
        leaf.position.x+=step*(leaf.velocity.x+Math.sin(age*2.7+leaf.phase)*.32);
        leaf.position.y+=step*leaf.velocity.y;
        leaf.position.z+=step*(leaf.velocity.z+Math.cos(age*2.15+leaf.phase)*.22);
        leaf.rotation.x+=step*leaf.spin.x;leaf.rotation.y+=step*leaf.spin.y;leaf.rotation.z+=step*leaf.spin.z;
        if(leaf.position.y<=.2){leaf.position.y=.2;leaf.landedAt=time;leaf.rotation.x=-Math.PI/2;}
      }
    }
    // Compact instances after expired leaves are returned to the pool.
    for(let i=0;i<activeLeaves.length;i++){
      const leaf=activeLeaves[i],shrink=leaf.landedAt===null?1:Math.max(0,1-(time-leaf.landedAt)/1.15);
      dummy.position.copy(leaf.position);dummy.rotation.copy(leaf.rotation);dummy.scale.set(leaf.width*shrink,leaf.height*shrink,shrink);dummy.updateMatrix();
      fallingLeaves.setMatrixAt(i,dummy.matrix);fallingLeaves.setColorAt(i,leaf.color);
    }
    fallingLeaves.count=activeLeaves.length;fallingLeaves.visible=activeLeaves.length>0;
    fallingLeaves.instanceMatrix.needsUpdate=true;fallingLeaves.instanceColor.needsUpdate=true;
  }

  function disposeInteractions(){
    if(interactionsDisposed)return;interactionsDisposed=true;
    tree.rotation.copy(restRotation);tree.updateMatrixWorld(true);
    activeLeaves.length=0;swayImpulses.length=0;scene.remove(fallingLeaves);
    fallingLeaves.dispose();fallingLeafMaterial.dispose();
  }
  // Sparse bamboo behind the pavilion adds a silhouette without hiding its roof.
  const bambooMat=new THREE.MeshStandardMaterial({color:'#385a50',roughness:.95});
  for(let i=0;i<14;i++){
    const x=range(9,11.4),z=range(-9.8,-7),h=range(2.7,5.1);
    beam(scene,bambooMat,[x,.2,z],[x+range(-.35,.35),h,z],.045,6);
    for(let j=0;j<5;j++)for(const sign of [-1,1]){
      const y=h*.4+j*h*.1;beam(scene,bambooMat,[x,y,z],[x+sign*.4,y+.25,z+.2],.017,4);
      const leaf=mesh(scene,leafGeometry,leafMaterial,[x+sign*.46,y+.26,z+.22],[.3,sign*.5,-sign*1.1],false);leaf.scale.set(.12,.45,.12);
    }
  }
  // Broad lotus leaves have a radial fold, scalloped edge, notch and veins.
  const lotusMaterial=new THREE.MeshStandardMaterial({color:'#476e57',side:THREE.DoubleSide,roughness:.72});
  const stemMaterial=new THREE.MeshStandardMaterial({color:'#41684d',roughness:1});
  const veinMaterial=new THREE.LineBasicMaterial({color:'#759369',transparent:true,opacity:.28});
  const petalMaterial=new THREE.MeshStandardMaterial({color:'#d5b8b9',side:THREE.DoubleSide,roughness:.6});
  const lotusPositions=[[-7.9,5.5,.65],[-6.5,3.6,.54],[-5.3,7.4,.7],[-3.7,5.9,.48],[-2,7.6,.5],[.6,6.3,.65],[2.7,7.4,.76],[4.3,5.4,.6],[6.6,6.7,.73],[8.2,4.8,.55],[-8.3,1.7,.4],[-.4,3.8,.42],[7.8,1.7,.43]];
  const lotuses=[];
  for(let i=0;i<lotusPositions.length;i++){
    const [x,z,r]=lotusPositions[i],height=range(.07,.42),group=new THREE.Group();group.position.set(x,height,z);group.rotation.set(range(-.08,.08),range(0,6.28),range(-.08,.08));scene.add(group);
    const positions=[0,0,0],uv=[.5,.5],indices=[];const count=48;
    for(let j=0;j<=count;j++){
      const a=.11+j/count*(Math.PI*2-.22),radius=r*(1+Math.sin(a*7)*.055);positions.push(Math.cos(a)*radius,.09+Math.sin(a*6)*.025+Math.cos(a)*.025,Math.sin(a)*radius);uv.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);
      if(j<count)indices.push(0,j+1,j+2);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(group,geometry,lotusMaterial,[0,0,0],[0,0,0],false);
    for(let j=0;j<12;j++){
      const a=.13+j/12*(Math.PI*2-.26),points=[new THREE.Vector3(0,.006,0),new THREE.Vector3(Math.cos(a)*r*.45,.045,Math.sin(a)*r*.45),new THREE.Vector3(Math.cos(a)*r*.97,.098,Math.sin(a)*r*.97)];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),veinMaterial);group.add(line);
    }
    beam(scene,stemMaterial,[x,-.2,z],[x,height,z],.017,6);lotuses.push({group,height,phase:range(0,6.28)});
    if(i%3===0){
      const flower=new THREE.Group();flower.position.set(x+.45,height+.3,z-.2);scene.add(flower);beam(scene,stemMaterial,[x+.45,-.1,z-.2],[x+.45,height+.32,z-.2],.016,6);
      for(let j=0;j<14;j++){
        const a=j/14*Math.PI*2,p=mesh(flower,new THREE.SphereGeometry(1,10,8),petalMaterial,[Math.cos(a)*.095,.07,Math.sin(a)*.095],[Math.sin(a)*.65,a,Math.cos(a)*.65],false);p.scale.set(.065,.16,.045);
      }cylinder(flower,blossomMaterial,.045,.03,.07,[0,.11,0],10);
    }
  }
  // Thin reeds along the foreground, also instanced.
  const reedGeo=new THREE.PlaneGeometry(.035,.75);reedGeo.translate(0,.375,0);const reedMat=new THREE.MeshStandardMaterial({color:'#3c6351',side:THREE.DoubleSide,roughness:1});
  const reeds=new THREE.InstancedMesh(reedGeo,reedMat,550);
  for(let i=0;i<550;i++){
    dummy.position.set(range(-12,12),.1,range(9.1,11.6));dummy.rotation.set(range(-.22,.22),range(0,6.28),range(-.24,.24));dummy.scale.set(range(.65,1.2),range(.5,1.6),1);dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);
  }scene.add(reeds);
  return {tree,leaves,blossoms,lotuses,leafInteractionTargets:[leaves,blossoms],sway,update,disposeInteractions,get fallingLeafCount(){return activeLeaves.length;}};
}
