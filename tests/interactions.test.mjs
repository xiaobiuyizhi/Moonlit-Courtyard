import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {pickCourtyardAction} from '../src/picking.js';
import {createFireworks} from '../src/fireworks.js';
import {createFishJumps} from '../src/fish.js';
import {buildNature} from '../src/nature.js';

test('visible surfaces receive clicks; a roof blocks the pond behind it',()=>{
  const water=new THREE.Mesh(new THREE.PlaneGeometry(22.6,16),new THREE.MeshBasicMaterial());
  water.rotation.x=-Math.PI/2;water.position.z=1.8;water.updateMatrixWorld();
  const roof=new THREE.Mesh(new THREE.BoxGeometry(2,1,2),new THREE.MeshBasicMaterial());
  roof.position.y=2;roof.updateMatrixWorld();
  const foliage=new THREE.Mesh(new THREE.SphereGeometry(1),new THREE.MeshBasicMaterial());
  foliage.position.y=5;foliage.updateMatrixWorld();
  const ray=new THREE.Raycaster(new THREE.Vector3(0,10,0),new THREE.Vector3(0,-1,0));
  assert.equal(pickCourtyardAction(ray,[water],[],water).kind,'water');
  assert.equal(pickCourtyardAction(ray,[water,roof],[],water),null);
  assert.equal(pickCourtyardAction(ray,[water,roof,foliage],[foliage],water).kind,'tree');
  ray.set(new THREE.Vector3(0,6,20),new THREE.Vector3(0,.5,-1).normalize());
  assert.equal(pickCourtyardAction(ray,[water,roof],[],water).kind,'sky');
  ray.set(new THREE.Vector3(15,10,0),new THREE.Vector3(0,-1,0));
  assert.equal(pickCourtyardAction(ray,[water],[],water),null);
  [water,roof,foliage].forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose();});
});

test('repeated fireworks stay within the pool and are reclaimed',()=>{
  const scene=new THREE.Scene(),effect=createFireworks(scene,{});
  const point=new THREE.Vector3(0,12,-10);
  for(let i=0;i<20;i++)effect.launch(point,0);
  assert.equal(effect.activeCount,4);
  effect.update(1.5,.016);
  assert.ok(scene.children[0].geometry.drawRange.count>100);
  effect.update(10,.016);
  assert.equal(effect.activeCount,0);
  assert.ok(effect.launch(point,10,'low'));
  assert.ok(effect.launch(point,10,'low'));
  assert.equal(effect.launch(point,10,'low'),false);
  effect.dispose();assert.equal(scene.children.length,0);
  assert.equal(effect.launch(point,12),false);
});

test('fish jump, splash on landing, and reuse a bounded pool',()=>{
  const scene=new THREE.Scene(),ripples=[];
  const effect=createFishJumps(scene,{}, {onRipple:(...args)=>ripples.push(args)});
  const point=new THREE.Vector3(1,0,4);
  for(let i=0;i<20;i++)effect.jump(point,0);
  assert.ok(effect.activeCount>0&&effect.activeCount<=3);
  const koi=scene.children.find(object=>object.name==='jumping-koi-1');
  const fishSize=new THREE.Box3().setFromObject(koi).getSize(new THREE.Vector3());
  assert.ok(fishSize.length()<.85,'the koi should remain small beside the lotus leaves');
  const atTakeoff=ripples.length;
  effect.update(.5,.016);
  effect.update(10,.016);
  assert.equal(effect.activeCount,0);
  assert.ok(ripples.length>atTakeoff,'landing should create a new ripple');
  assert.ok(ripples.flat().every(Number.isFinite));
  assert.ok(effect.jump(point,11));
  effect.dispose();assert.equal(scene.children.length,0);
});

test('tree shake releases bounded leaves and settles back to rest',()=>{
  const scene=new THREE.Scene();
  const nature=buildNature(scene,{wood:null},{stone:new THREE.MeshStandardMaterial()});
  assert.ok(nature.sway(0,new THREE.Vector3(-2,5,-7),'high',false));
  assert.ok(nature.fallingLeafCount>0&&nature.fallingLeafCount<=72);
  for(let i=0;i<12;i++)nature.sway(i*.3,new THREE.Vector3(-2,5,-7),'high',false);
  assert.ok(nature.fallingLeafCount<=72);
  nature.update(20,.016);
  assert.equal(nature.fallingLeafCount,0);
  assert.ok(Math.abs(nature.tree.rotation.z)<.001);
  nature.disposeInteractions();
  assert.equal(nature.fallingLeafCount,0);
});

test('small koi keep swimming below the surface and stay inside the pond',()=>{
  const scene=new THREE.Scene(),effect=createFishJumps(scene,{});
  effect.update(0,.016,'high');
  const swimmers=scene.children.filter(object=>object.name.startsWith('swimming-koi-'));
  assert.equal(effect.swimmingCount,5);
  const initial=swimmers.map(fish=>fish.position.clone());
  for(let time=1;time<=300;time++){
    effect.update(time,.016,'high');
    for(const fish of swimmers){
      assert.ok(fish.position.y<-.1&&fish.position.y>-.4);
      assert.ok(fish.position.x>-10.2&&fish.position.x<10.2);
      assert.ok(fish.position.z>-5.8&&fish.position.z<8.6);
    }
  }
  assert.ok(swimmers.some((fish,i)=>fish.position.distanceTo(initial[i])>.1));
  effect.update(300,.016,'low');assert.equal(effect.swimmingCount,3);
  effect.dispose();assert.equal(effect.swimmingCount,0);
  assert.equal(scene.children.length,0);
});
