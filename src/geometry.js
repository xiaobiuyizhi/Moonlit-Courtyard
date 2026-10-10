import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Bake static meshes by material. Keep animated groups and instanced vegetation intact.
export function mergeStaticMeshes(root,excluded=new Set()) {
  root.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),groups=new Map();
  function visit(object){
    if(excluded.has(object))return;
    if(object.isMesh&&!object.isInstancedMesh&&!Array.isArray(object.material)){
      const key=object.material.uuid+':'+Object.keys(object.geometry.attributes).sort().join(',');
      if(!groups.has(key))groups.set(key,{material:object.material,objects:[],geometries:[]});
      const group=groups.get(key),geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));group.objects.push(object);group.geometries.push(geometry);
    }
    object.children.forEach(visit);
  }visit(root);
  for(const {material,objects,geometries}of groups.values()){
    if(objects.length<2){geometries.forEach(g=>g.dispose());continue;}
    const merged=mergeGeometries(geometries,false);if(!merged){geometries.forEach(g=>g.dispose());continue;}
    const combined=new THREE.Mesh(merged,material);combined.castShadow=objects.some(o=>o.castShadow);combined.receiveShadow=objects.some(o=>o.receiveShadow);root.add(combined);
    objects.forEach(object=>{object.parent.remove(object);object.geometry.dispose();});geometries.forEach(g=>g.dispose());
  }
}

export function mesh(parent, geometry, material, position=[0,0,0], rotation=[0,0,0], cast=true) {
  const object=new THREE.Mesh(geometry,material);
  object.position.set(...position);object.rotation.set(...rotation);
  object.castShadow=cast;object.receiveShadow=true;parent.add(object);return object;
}
export function box(parent,material,size,position,rotation=[0,0,0]) {
  return mesh(parent,new THREE.BoxGeometry(...size),material,position,rotation);
}
export function cylinder(parent,material,top,bottom,height,position,segments=12) {
  return mesh(parent,new THREE.CylinderGeometry(top,bottom,height,segments),material,position);
}
export function beam(parent,material,a,b,radius=.05,segments=8) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
  const object=mesh(parent,new THREE.CylinderGeometry(radius,radius,direction.length(),segments),material);
  object.position.copy(start.add(end).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return object;
}
export function curvedTube(parent, material, points, radius=.05, segments=24) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return mesh(parent,new THREE.TubeGeometry(curve,segments,radius,8,false),material);
}
