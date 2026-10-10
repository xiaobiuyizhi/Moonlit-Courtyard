import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Water} from 'three/addons/objects/Water.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {makeTextures,range} from './textures.js';
import {buildArchitecture,buildLanterns} from './architecture.js';
import {buildNature} from './nature.js';
import {buildSky,buildMist,buildParticles,buildRipples} from './atmosphere.js';
import {createSoundscape} from './audio.js';
import {createFireworks} from './fireworks.js';
import {createFishJumps} from './fish.js';
import {pickCourtyardAction} from './picking.js';

const $=id=>document.getElementById(id);
const narrow=()=>window.innerWidth<=600;
const mobile=matchMedia('(pointer: coarse)').matches;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function showError(error){console.error(error);$('loading').classList.add('is-loaded');$('error').hidden=false;$('error-message').textContent=error.message?.includes('WebGL')?'当前浏览器无法启动 3D 场景，请使用支持 WebGL 2 的现代浏览器，并开启硬件加速。':'场景未能载入，请刷新页面后重试。';}

async function initialize(){
  const canvas=$('courtyard');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#152838',.0075);
  const camera=new THREE.PerspectiveCamera(narrow()?65:43,innerWidth/innerHeight,.1,180);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.065;controls.enablePan=false;controls.minDistance=7;controls.maxDistance=43;controls.minPolarAngle=.28;controls.maxPolarAngle=Math.PI/2-.075;controls.rotateSpeed=.5;controls.zoomSpeed=.8;
  // Keep every orbit above the pond. Polar bounds alone are relative to the target.
  const textures=makeTextures();
  const sky=buildSky(scene,textures);
  const hemi=new THREE.HemisphereLight('#a3c5e0','#324745',1.25);scene.add(hemi);
  const moonFill=new THREE.DirectionalLight('#7093b8',.45);moonFill.position.set(-7,9,16);scene.add(moonFill);
  const moonlight=new THREE.DirectionalLight('#bfdcff',2.25);moonlight.position.set(-8,16,-10);moonlight.target.position.set(0,0,0);scene.add(moonlight,moonlight.target);moonlight.castShadow=true;
  moonlight.shadow.mapSize.set(1024,1024);moonlight.shadow.camera.left=-16;moonlight.shadow.camera.right=16;moonlight.shadow.camera.top=16;moonlight.shadow.camera.bottom=-16;moonlight.shadow.camera.near=.5;moonlight.shadow.camera.far=60;moonlight.shadow.bias=-.00035;moonlight.shadow.normalBias=.035;
  const architecture=buildArchitecture(scene,textures);
  const lanterns=buildLanterns(scene,architecture.pavilion,textures,architecture.materials);
  const nature=buildNature(scene,textures,architecture.materials);
  const mist=buildMist(scene),particles=buildParticles(scene,textures),ripples=buildRipples(scene);
  const water=new Water(new THREE.PlaneGeometry(22.6,16),{
    textureWidth:mobile?512:1024,textureHeight:mobile?512:1024,waterNormals:textures.normal,
    sunDirection:new THREE.Vector3(-.3,.9,-.3).normalize(),sunColor:'#b4d2e8',waterColor:'#153d42',distortionScale:1.7,alpha:.46,fog:true,
  });
  water.rotation.x=-Math.PI/2;water.position.set(0,0,1.8);scene.add(water);
  // Real submerged koi render beneath a translucent, reflective shallow surface.
  water.material.transparent=true;water.material.depthWrite=false;water.renderOrder=2;
  const pondBed=new THREE.Mesh(new THREE.PlaneGeometry(22.6,16),new THREE.MeshStandardMaterial({color:'#183839',map:textures.stone,roughness:1}));
  pondBed.rotation.x=-Math.PI/2;pondBed.position.set(0,-.6,1.8);pondBed.userData.interactionEffect=true;scene.add(pondBed);
  ripples.ripples.forEach(ring=>ring.renderOrder=3);
  water.material.uniforms.size.value=4;
  // Add local radial waves to the normal used for reflection, so a tap distorts it too.
  water.material.uniforms.uRipples={value:Array.from({length:5},()=>new THREE.Vector3(99,99,-1000))};
  water.material.uniforms.uRealTime={value:0};
  water.material.fragmentShader=water.material.fragmentShader
    .replace('uniform float size;', 'uniform float size; uniform vec3 uRipples[5]; uniform float uRealTime;')
    .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',`
      vec2 rippleNormal=vec2(0.);
      for(int i=0;i<5;i++){
        float age=uRealTime-uRipples[i].z; vec2 offset=worldPosition.xz-uRipples[i].xy; float radius=length(offset);
        float band=exp(-pow((radius-age*.55)*2.4,2.))*max(0.,1.-age/5.)*step(0.,age);
        rippleNormal+=offset/max(radius,.01)*cos(radius*22.-age*4.)*band*.038;
      }
      vec3 surfaceNormal=normalize(noise.xzy*vec3(1.5,1.,1.5)+vec3(rippleNormal.x,0.,rippleNormal.y));
    `)
    .replace('vec3( 0.1 ) + reflectionSample * 0.9', 'vec3( 0.022, 0.032, 0.038 ) + reflectionSample * 0.94')
    .replace('vec4( outgoingLight, alpha )','vec4( outgoingLight, clamp(alpha + reflectance * .38, .46, .84) )');
  function triggerRipple(x,z,time){const slot=ripples.trigger(x,z,time);water.material.uniforms.uRipples.value[slot].set(x,z,time);window.__courtyard.rippleEvents++;}
  const pickTargets=[water];
  scene.traverse(object=>{if(object.isMesh&&object.material?.isMeshStandardMaterial&&!object.userData.interactionEffect)pickTargets.push(object);});
  const fireworks=createFireworks(scene,textures,{reducedMotion});
  const fish=createFishJumps(scene,textures,{reducedMotion,onRipple:triggerRipple});
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.25,.45,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
  const audio=createSoundscape();
  const qualityLevels={high:{pixelRatio:Math.min(devicePixelRatio,1.8),bloom:true,shadows:true,leaves:3100,flowers:1200,particles:150,petals:110,reflectionEvery:1},balanced:{pixelRatio:Math.min(devicePixelRatio,1.3),bloom:true,shadows:true,leaves:2400,flowers:900,particles:110,petals:80,reflectionEvery:2},low:{pixelRatio:1,bloom:false,shadows:false,leaves:1700,flowers:650,particles:65,petals:45,reflectionEvery:3}};
  let currentQuality,frame=0,elapsed=0,qualityMode='auto',reflectionFrame=-1;
  const reflect=water.onBeforeRender;
  water.onBeforeRender=function(...args){if(reflectionFrame<0||frame-reflectionFrame>=qualityLevels[currentQuality].reflectionEvery){reflectionFrame=frame;reflect.apply(this,args);}};
  function setQuality(level){
    currentQuality=level;const q=qualityLevels[level];renderer.setPixelRatio(q.pixelRatio);composer.setPixelRatio(q.pixelRatio);bloom.enabled=q.bloom;renderer.shadowMap.enabled=q.shadows;
    nature.leaves.count=q.leaves;nature.blossoms.count=q.flowers;particles.fireflies.geometry.setDrawRange(0,q.particles);particles.petals.geometry.setDrawRange(0,q.petals);
    resize();window.__courtyard.quality=level;
  }
  const views={
    courtyard:()=>({position:narrow()?[14,9.3,29]:[6.5,5.9,21.4],target:[0,2.1,-1.3]}),
    water:()=>({position:narrow()?[3.8,3.5,17]:[1.2,2.5,15],target:[.4,1.9,-3.8]}),
    pavilion:()=>({position:[10.1,4.4,5.4],target:[5.3,2,-3]}),
  };
  let activeView='courtyard',transition,userAdjustedCamera=false,lastNarrow=narrow();
  function selectView(name,animate=true){
    activeView=name;userAdjustedCamera=false;const view=views[name]();document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));
    if(animate&&!reducedMotion)transition={start:elapsed,from:camera.position.clone(),targetFrom:controls.target.clone(),to:new THREE.Vector3(...view.position),targetTo:new THREE.Vector3(...view.target)};
    else{transition=null;camera.position.set(...view.position);controls.target.set(...view.target);controls.update();}
  }
  function resize(){
    camera.aspect=innerWidth/innerHeight;camera.fov=narrow()?65:43;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);
    if(lastNarrow!==narrow()){lastNarrow=narrow();if(!userAdjustedCamera)selectView(activeView,false);if(lastNarrow)toggleSettings(false);}
  }
  window.__courtyard={ready:false,quality:'',frames:0,sceneObjects:0,rippleEvents:0,fireworkEvents:0,fishEvents:0,treeEvents:0,webgl:renderer.capabilities.isWebGL2,settings:{moonlight:100,lanterns:100,mist:55},get camera(){return camera.position.toArray();},get target(){return controls.target.toArray();},get view(){return activeView;},get activeEffects(){return {fireworks:fireworks.activeCount,fish:fish.activeCount,swimming:fish.swimmingCount,leaves:nature.fallingLeafCount};}};
  setQuality(mobile?'balanced':'high');selectView('courtyard',false);
  function updateSlider(id,handler){
    const input=$(id);function update(){const value=Number(input.value);$(id+'-value').value=value+'%';const progress=(value-Number(input.min))/(Number(input.max)-Number(input.min))*100;input.style.background=`linear-gradient(to right,var(--gold) ${progress}%,#76888a44 ${progress}%)`;handler(value/100);window.__courtyard.settings[id]=value;}input.addEventListener('input',update);update();
  }
  updateSlider('moonlight',value=>{moonlight.intensity=2.25*value;moonFill.intensity=.45*value;hemi.intensity=.5+value*.75;sky.moonMaterial.color.setRGB(.6+value*.4,.6+value*.36,.52+value*.3);sky.halo.material.opacity=.06+value*.07;water.material.uniforms.sunColor.value.setRGB(.32*value,.45*value,.6*value);});
  updateSlider('lanterns',value=>{lanterns.lights.forEach((light,i)=>light.intensity=lanterns.baseIntensities[i]*value);lanterns.silk.emissiveIntensity=2.2*value;lanterns.ribs.emissiveIntensity=.25*value;lanterns.glows.forEach(glow=>glow.material.opacity=.2*value);});
  updateSlider('mist',value=>{mist.mistMaterial.uniforms.uOpacity.value=value;scene.fog.density=.006+value*.0027;});
  $('quality').addEventListener('change',event=>{qualityMode=event.target.value;setQuality(qualityMode==='auto'?(mobile?'balanced':'high'):qualityMode);toast('已切换画质');});
  function toggleSettings(force){const open=force??$('settings-toggle').getAttribute('aria-expanded')==='false';$('settings-toggle').setAttribute('aria-expanded',String(open));document.querySelector('.settings').classList.toggle('collapsed',!open);}
  $('settings-toggle').addEventListener('click',()=>toggleSettings());if(narrow())toggleSettings(false);
  $('reset').addEventListener('click',()=>{selectView('courtyard');toast('回到初见的月色');});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.view)));
  controls.addEventListener('start',()=>{transition=null;userAdjustedCamera=true;});
  $('fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('此浏览器暂不支持网页全屏');}catch{toast('浏览器未允许进入全屏');}
  });
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');});
  $('sound').addEventListener('click',async()=>{
    const enabled=$('sound').getAttribute('aria-pressed')!=='true';try{await audio.setEnabled(enabled);$('sound').setAttribute('aria-pressed',String(enabled));$('sound').setAttribute('aria-label',enabled?'关闭庭院环境音':'开启庭院环境音');toast(enabled?'风过桂枝，水声入耳':'环境音已关闭');}catch(error){toast(error.message);}
  });
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerDown;const activePointers=new Set();
  canvas.addEventListener('pointerdown',event=>{activePointers.add(event.pointerId);pointerDown=activePointers.size===1&&event.button===0?{id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),moved:false}:null;});
  canvas.addEventListener('pointermove',event=>{if(pointerDown?.id===event.pointerId&&Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)>7)pointerDown.moved=true;});
  canvas.addEventListener('pointercancel',event=>{activePointers.delete(event.pointerId);pointerDown=null;});
  canvas.addEventListener('pointerup',event=>{
    activePointers.delete(event.pointerId);
    if(!pointerDown||pointerDown.id!==event.pointerId||pointerDown.moved||activePointers.size||Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)>7||performance.now()-pointerDown.time>450){pointerDown=null;return;}pointerDown=null;
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    scene.updateMatrixWorld(true);
    const action=pickCourtyardAction(raycaster,pickTargets,nature.leafInteractionTargets,water);
    if(action?.kind==='water'&&fish.jump(action.point,elapsed,currentQuality))window.__courtyard.fishEvents++;
    else if(action?.kind==='tree'&&nature.sway(elapsed,action.point,currentQuality,reducedMotion))window.__courtyard.treeEvents++;
    else if(action?.kind==='sky'&&fireworks.launch(action.point,elapsed,currentQuality))window.__courtyard.fireworkEvents++;
  });
  window.addEventListener('resize',resize);
  let animationId,lastTime=performance.now(),fpsStart=lastTime,fpsFrames=0,slowWindows=0;
  function animate(now){
    animationId=requestAnimationFrame(animate);const delta=Math.min((now-lastTime)/1000,.05);lastTime=now;elapsed+=delta;frame++;fpsFrames++;
    if(transition){const t=Math.min((elapsed-transition.start)/1.7,1),ease=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,ease);controls.target.lerpVectors(transition.targetFrom,transition.targetTo,ease);if(t===1)transition=null;}
    controls.update();camera.position.y=Math.max(camera.position.y,.9);
    const motionTime=elapsed*(reducedMotion?.25:1);
    water.material.uniforms.time.value=motionTime*.35;water.material.uniforms.uRealTime.value=elapsed;sky.skyMaterial.uniforms.uTime.value=motionTime;mist.mistMaterial.uniforms.uTime.value=motionTime;particles.update(motionTime);ripples.update(elapsed);
    fireworks.update(elapsed,delta);fish.update(elapsed,delta,currentQuality);nature.update(elapsed,delta);
    nature.lotuses.forEach(({group,height,phase})=>{group.position.y=height+Math.sin(motionTime*.75+phase)*.018;});
    lanterns.lanterns.forEach((lantern,i)=>lantern.rotation.z=Math.sin(motionTime*.6+i)*.018);
    if(frame%470===0)triggerRipple(range(-7,7),range(-2,7),elapsed);
    composer.render();window.__courtyard.frames=frame;
    if(frame===4){window.__courtyard.ready=true;scene.traverse(()=>window.__courtyard.sceneObjects++);$('loading').classList.add('is-loaded');}
    if(now-fpsStart>4000){
      const fps=fpsFrames*1000/(now-fpsStart);window.__courtyard.fps=Math.round(fps);
      if(qualityMode==='auto'&&fps<28&&frame>120){slowWindows++;if(slowWindows>=2&&currentQuality!=='low'){setQuality(currentQuality==='high'?'balanced':'low');slowWindows=0;}}
      else slowWindows=0;fpsStart=now;fpsFrames=0;
    }
  }
  function onVisibilityChange(){
    if(document.hidden){cancelAnimationFrame(animationId);audio.suspend();}
    else{lastTime=performance.now();fpsStart=lastTime;fpsFrames=0;audio.resume().catch(()=>{});cancelAnimationFrame(animationId);animationId=requestAnimationFrame(animate);}
  }
  document.addEventListener('visibilitychange',onVisibilityChange);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(animationId);toast('图形上下文已中断，恢复后会重新载入');});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(animationId);audio.dispose();fireworks.dispose();fish.dispose();nature.disposeInteractions();pondBed.geometry.dispose();pondBed.material.dispose();document.removeEventListener('visibilitychange',onVisibilityChange);controls.dispose();composer.dispose();renderer.dispose();});
  animationId=requestAnimationFrame(animate);
}
initialize().catch(showError);
