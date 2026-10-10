// Only the nearest solid surface can receive a tap, even behind roofs and leaves.
export function pickCourtyardAction(raycaster,targets,leafTargets,water) {
  const hit=raycaster.intersectObjects(targets,false)[0];
  if(hit){
    if(leafTargets.includes(hit.object))return {kind:'tree',point:hit.point};
    if(hit.object===water){
      const p=hit.point;
      if(p.x>-10.2&&p.x<10.2&&p.z>-5.8&&p.z<8.6)return {kind:'water',point:p};
    }
    return null;
  }
  if(raycaster.ray.direction.y>-.04){
    const point=raycaster.ray.at(34,raycaster.ray.origin.clone());
    point.y=Math.max(point.y,8);
    return {kind:'sky',point};
  }
  return null;
}
