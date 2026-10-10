import * as THREE from 'three';

// A fixed pool keeps repeated pond taps from adding meshes or GPU resources.
export function createFishJumps(scene, textures, {reducedMotion = false, onRipple = () => {}} = {}) {
  const geometries = new Set();
  const materials = new Set();
  const ownGeometry = geometry => (geometries.add(geometry), geometry);
  const ownMaterial = material => (materials.add(material), material);
  const sphere = ownGeometry(new THREE.SphereGeometry(1, 14, 10));
  const pearl = ownMaterial(new THREE.MeshStandardMaterial({color:'#fff6de', roughness:.3, emissive:'#d8d2c0', emissiveIntensity:.08}));
  const bodyMaterial = ownMaterial(new THREE.MeshStandardMaterial({vertexColors:true, roughness:.28, metalness:.06, emissive:'#d6b48c', emissiveIntensity:.1}));
  const goldenBodyMaterial = ownMaterial(bodyMaterial.clone());
  goldenBodyMaterial.color.set('#ffe2aa');
  goldenBodyMaterial.emissiveIntensity=.17;
  const finMaterial = ownMaterial(new THREE.MeshStandardMaterial({color:'#f3c88b', roughness:.48, transparent:true, opacity:.66, side:THREE.DoubleSide, depthWrite:false, emissive:'#bf8545', emissiveIntensity:.08}));
  const dark = ownMaterial(new THREE.MeshStandardMaterial({color:'#07131b', roughness:.18}));
  // One continuous spindle joins the small head to a tapered tail peduncle.
  const profileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.017,-.38,0), new THREE.Vector3(.04,-.29,0),
    new THREE.Vector3(.072,-.2,0), new THREE.Vector3(.092,-.07,0),
    new THREE.Vector3(.098,.09,0), new THREE.Vector3(.087,.22,0),
    new THREE.Vector3(.061,.3,0), new THREE.Vector3(.024,.35,0),
    new THREE.Vector3(0,.367,0),
  ]);
  const bodyGeometry = ownGeometry(new THREE.LatheGeometry(profileCurve.getPoints(64).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y)), 32));
  bodyGeometry.rotateZ(-Math.PI/2);
  bodyGeometry.scale(1,1.15,.88);
  const bodyPositions = bodyGeometry.attributes.position;
  const colors = new Float32Array(bodyPositions.count*3);
  const ivoryColor = new THREE.Color('#fff6e4'), orangeColor = new THREE.Color('#e9651b'), color = new THREE.Color();
  for (let i=0; i<bodyPositions.count; i++) {
    const x=bodyPositions.getX(i), y=bodyPositions.getY(i), z=bodyPositions.getZ(i);
    const noise=Math.sin(x*47+z*31)*.12+Math.sin(z*68-y*33)*.08;
    const head=((x-.235)/.095)**2+((y-.045)/.096)**2+((z+.016)/.089)**2;
    const saddle=((x+.075)/.105)**2+((y-.071)/.061)**2+((z-.014)/.11)**2;
    const tailSpot=((x+.255)/.058)**2+((y-.025)/.062)**2+((z+.028)/.072)**2;
    const field=Math.min(head,saddle,tailSpot)+noise;
    const patch=1-THREE.MathUtils.smoothstep(field,.72,1.13);
    color.copy(ivoryColor).lerp(orangeColor,patch);
    colors.set([color.r,color.g,color.b],i*3);
  }
  bodyGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const shapeGeometry = draw => {
    const shape=new THREE.Shape(); draw(shape);
    return ownGeometry(new THREE.ShapeGeometry(shape,10));
  };
  const tailGeometry=shapeGeometry(s=>{
    s.moveTo(.025,.014);s.bezierCurveTo(-.055,.035,-.13,.123,-.222,.15);
    s.bezierCurveTo(-.222,.083,-.17,.041,-.145,0);
    s.bezierCurveTo(-.17,-.041,-.222,-.083,-.222,-.15);
    s.bezierCurveTo(-.13,-.123,-.055,-.035,.025,-.014);s.closePath();
  });
  const dorsalGeometry=shapeGeometry(s=>{
    s.moveTo(.15,.09);s.bezierCurveTo(.083,.152,-.023,.165,-.165,.088);
    s.bezierCurveTo(-.054,.101,.048,.11,.15,.09);s.closePath();
  });
  const pectoralGeometry=shapeGeometry(s=>{
    s.moveTo(0,0);s.bezierCurveTo(-.035,.06,-.09,.106,-.152,.109);
    s.bezierCurveTo(-.149,.041,-.081,.012,0,0);s.closePath();
  });
  pectoralGeometry.rotateX(Math.PI/2);
  const forward = new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3();
  const roll = new THREE.Quaternion();
  const splashCount = 32;
  let disposed = false;
  let nextDirection = 0;
  let swimmingQuality = 'high';

  function addEllipsoid(group, material, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    group.add(mesh);
    return mesh;
  }

  function createFish(name, material = bodyMaterial) {
    const root = new THREE.Group();
    root.name = name;
    root.userData.interactionEffect = true;
    scene.add(root);
    root.add(new THREE.Mesh(bodyGeometry,material));
    const tail = new THREE.Mesh(tailGeometry, finMaterial);
    tail.position.x = -.374;
    root.add(tail);
    root.add(new THREE.Mesh(dorsalGeometry, finMaterial));
    const fins = [];
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(pectoralGeometry, finMaterial);
      fin.position.set(.105, -.043, .063 * side);
      fin.scale.z = side;
      root.add(fin);
      fins.push(fin);
      addEllipsoid(root, dark, .279, .026, .061 * side, .0105, .011, .004);
      addEllipsoid(root, pearl, .282, .031, .0644 * side, .0022, .0026, .001);
    }
    root.scale.setScalar(.62);
    root.traverse(object=>{if(object.isMesh && object.material.transparent)object.renderOrder=1;});
    return {root,tail,fins};
  }

  function createSlot(index) {
    const {root,tail,fins}=createFish(`jumping-koi-${index+1}`);
    root.visible=false;

    const positions = new Float32Array(splashCount * 3);
    const splashGeometry = ownGeometry(new THREE.BufferGeometry());
    splashGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    const splashMaterial = ownMaterial(new THREE.PointsMaterial({color:'#c3dce7', map:textures?.glow ?? null, size:.039, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending}));
    const splash = new THREE.Points(splashGeometry, splashMaterial);
    splash.visible = false;
    // Points move in world space; do not let the initial zero-sized bound cull them.
    splash.frustumCulled = false;
    scene.add(splash);
    const droplets = Array.from({length:splashCount}, (_, i) => {
      const angle = i * 2.39996 + index;
      const speed = .18 + (i % 7) * .07;
      return {vx:Math.cos(angle) * speed, vz:Math.sin(angle) * speed, vy:.8 + (i % 5) * .16};
    });
    return {root, tail, fins, splash, positions, droplets, flying:false, born:0, duration:1.25, height:.85, start:new THREE.Vector3(), end:new THREE.Vector3(), splashOrigin:new THREE.Vector3(), splashBorn:-10, splashLife:.58, splashActive:false, splashTotal:splashCount};
  }
  const slots = Array.from({length:3}, (_, i) => createSlot(i));
  const routes = [
    {x:-3,z:1.8,rx:1.18,rz:.82,speed:.36,phase:.3},
    {x:0,z:3,rx:1.3,rz:.94,speed:.33,phase:2.1},
    {x:3,z:4.5,rx:1.13,rz:.84,speed:.4,phase:4.5},
    {x:-4.7,z:5.1,rx:1.34,rz:.86,speed:.34,phase:3.1},
    {x:5,z:-.5,rx:1.2,rz:.9,speed:.37,phase:5.2},
  ];
  const swimmers = routes.map((route,index)=>({...createFish(`swimming-koi-${index+1}`,index%2?goldenBodyMaterial:bodyMaterial),route}));

  function updateSwimmers(time, quality) {
    const visibleCount=quality==='low'?3:5;
    const motionScale=reducedMotion ? .42 : 1;
    swimmers.forEach(({root,tail,fins,route},index)=>{
      root.visible=index<visibleCount;
      if(!root.visible) return;
      const phase=time*route.speed*motionScale+route.phase;
      // Small closed routes remain inside the open part of the real pond.
      const x=route.x+Math.cos(phase)*route.rx;
      const z=route.z+Math.sin(phase)*route.rz;
      root.position.set(x,-.205+Math.sin(phase*.73+index)*.033,z);
      tangent.set(-Math.sin(phase)*route.rx,Math.cos(phase*.73+index)*.024,Math.cos(phase)*route.rz).normalize();
      root.quaternion.setFromUnitVectors(forward,tangent);
      roll.setFromAxisAngle(forward,Math.sin(phase+index)*.055);
      root.quaternion.multiply(roll);
      const wag=Math.sin(time*(reducedMotion?3.5:7.5)+route.phase);
      tail.rotation.y=wag*.24;
      fins.forEach((fin,i)=>{fin.rotation.x=wag*.09*(i===0?-1:1);});
    });
  }

  function emitSplash(slot, position, time) {
    slot.splashOrigin.copy(position);
    slot.splashOrigin.y += .04;
    slot.splashBorn = time;
    slot.splashActive = true;
    slot.splash.visible = true;
    slot.splash.geometry.setDrawRange(0, slot.splashTotal);
    // Initialize immediately so a new burst cannot flash at its old location.
    for (let i = 0; i < slot.splashTotal; i++) {
      const offset = i * 3;
      slot.positions[offset] = slot.splashOrigin.x;
      slot.positions[offset + 1] = slot.splashOrigin.y;
      slot.positions[offset + 2] = slot.splashOrigin.z;
    }
    slot.splash.geometry.attributes.position.needsUpdate = true;
    slot.splash.material.opacity = .5;
  }

  function jump(position, time, quality = 'high') {
    if (disposed || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z) || !Number.isFinite(time)) return false;
    swimmingQuality=quality;
    const limit = reducedMotion || quality === 'low' ? 1 : 3;
    const slot = slots.slice(0, limit).find(candidate => !candidate.flying && !candidate.splashActive);
    if (!slot) return false;
    slot.start.copy(position);
    const angle = ++nextDirection * 2.39996;
    const travel = reducedMotion ? .4 : .65;
    slot.end.copy(position).add(new THREE.Vector3(Math.cos(angle) * travel, 0, Math.sin(angle) * travel));
    slot.end.x=THREE.MathUtils.clamp(slot.end.x,-10.1,10.1);
    slot.end.z=THREE.MathUtils.clamp(slot.end.z,-5.7,8.5);
    slot.born = time;
    slot.duration = reducedMotion ? 1.05 : 1.25;
    slot.height = reducedMotion ? .45 : .85;
    slot.splashTotal = reducedMotion ? 8 : quality === 'low' ? 12 : quality === 'balanced' ? 22 : splashCount;
    slot.flying = true;
    slot.root.visible = true;
    slot.root.position.copy(slot.start);
    slot.root.position.y -= .05;
    emitSplash(slot, slot.start, time);
    onRipple(slot.start.x, slot.start.z, time);
    return true;
  }

  function update(time, delta, quality = swimmingQuality) {
    if (disposed) return;
    swimmingQuality=quality;
    updateSwimmers(time,quality);
    for (const slot of slots) {
      if (slot.flying) {
        const progress = Math.max(0, Math.min(1, (time - slot.born) / slot.duration));
        slot.root.position.lerpVectors(slot.start, slot.end, progress);
        slot.root.position.y += 4 * progress * (1 - progress) * slot.height - .05;
        tangent.subVectors(slot.end, slot.start);
        const maxPitchY=Math.hypot(tangent.x,tangent.z)*1.6;
        tangent.y = THREE.MathUtils.clamp(4*(1-2*progress)*slot.height,-maxPitchY,maxPitchY);
        tangent.normalize();
        slot.root.quaternion.setFromUnitVectors(forward, tangent);
        roll.setFromAxisAngle(forward, Math.sin(progress * Math.PI) * .15);
        slot.root.quaternion.multiply(roll);
        const wag = Math.sin((time - slot.born) * 17);
        slot.tail.rotation.y = wag * .2;
        slot.fins.forEach((fin, i) => {fin.rotation.x = wag * .12 * (i === 0 ? -1 : 1);});
        if (progress >= 1) {
          slot.flying = false;
          slot.root.visible = false;
          const landingTime = slot.born + slot.duration;
          emitSplash(slot, slot.end, landingTime);
          onRipple(slot.end.x, slot.end.z, landingTime);
        }
      }
      if (slot.splashActive) {
        const age = Math.max(0, time - slot.splashBorn);
        if (age >= slot.splashLife) {
          slot.splashActive = false;
          slot.splash.visible = false;
          continue;
        }
        for (let i = 0; i < slot.splashTotal; i++) {
          const drop = slot.droplets[i], offset = i * 3;
          slot.positions[offset] = slot.splashOrigin.x + drop.vx * age;
          slot.positions[offset + 1] = Math.max(slot.splashOrigin.y, slot.splashOrigin.y + drop.vy * age - 3.8 * age * age);
          slot.positions[offset + 2] = slot.splashOrigin.z + drop.vz * age;
        }
        slot.splash.material.opacity = .5 * (1 - age / slot.splashLife);
        slot.splash.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    slots.forEach(slot => {slot.flying=false;scene.remove(slot.root, slot.splash);});
    swimmers.forEach(({root})=>{root.visible=false;scene.remove(root);});
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  updateSwimmers(0,swimmingQuality);
  return {jump, update, dispose, get activeCount() {return disposed?0:slots.reduce((count, slot) => count + Number(slot.flying), 0);}, get swimmingCount() {return disposed?0:swimmers.reduce((count,{root})=>count+Number(root.visible),0);}};
}
