import * as THREE from 'three';
import {range} from './textures.js';

const noiseGLSL=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.02+17.3;a*=.5;}return v;}
`;

export function buildSky(scene,textures){
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTime:{value:0}},vertexShader:`varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
    varying vec3 vPosition;uniform float uTime;${noiseGLSL}
    void main(){vec3 d=normalize(vPosition);float h=max(d.y,0.);vec3 color=mix(vec3(.011,.022,.039),vec3(.002,.005,.015),smoothstep(0.,.75,h));
    float cloud=fbm(vec2(d.x*8.+uTime*.004,d.z*8.));float streak=fbm(vec2(d.x*2.+uTime*.006,d.y*32.));float layer=smoothstep(.48,.72,cloud*.4+streak*.6)*smoothstep(.01,.13,d.y)*(1.-smoothstep(.65,.9,d.y));
    color+=vec3(.015,.022,.029)*layer;gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }
  `});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(110,48,32),skyMaterial);sky.renderOrder=-10;scene.add(sky);
  const starPositions=[],starColors=[];
  for(let i=0;i<950;i++){
    const a=range(0,6.28),h=range(.07,1),r=Math.sqrt(1-h*h);starPositions.push(Math.cos(a)*r*96,h*96,Math.sin(a)*r*96);const b=range(.25,.8);starColors.push(b,b*.94,b*.86);
  }
  const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starsGeo.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
  scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({size:.085,vertexColors:true,transparent:true,opacity:.75,depthWrite:false,fog:false})));
  const moonMaterial=new THREE.MeshBasicMaterial({map:textures.moon,color:'#fff3d1',toneMapped:false,fog:false});
  const moon=new THREE.Mesh(new THREE.SphereGeometry(3.3,64,40),moonMaterial);moon.position.set(-3,14.4,-43);scene.add(moon);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.glow,color:'#c8d9ec',opacity:.12,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));halo.position.copy(moon.position);halo.position.z-=.5;halo.scale.set(19,19,1);scene.add(halo);
  // Distant ridges are low-contrast silhouettes, behind the courtyard wall.
  for(let layer=0;layer<3;layer++){
    const positions=[],indices=[];
    for(let i=0;i<=80;i++){
      const x=-180+i*4.5,height=1.9+Math.sin(x*.095+layer)*1.05+Math.sin(x*.18+layer*2)*.6;
      positions.push(x,height,-62-layer*8,x,-15,-62-layer*8);
      if(i<80){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
    scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:['#152330','#1c2b39','#22303f'][layer],side:THREE.DoubleSide,fog:false})));
  }
  return {skyMaterial,moon,moonMaterial,halo};
}

export function buildMist(scene){
  const mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:{value:0},uOpacity:{value:.55}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
    varying vec2 vUv;uniform float uTime;uniform float uOpacity;${noiseGLSL}
    void main(){vec2 p=vUv*vec2(5.,4.);float n=fbm(p+vec2(uTime*.018,-uTime*.009));float edge=smoothstep(0.,.2,vUv.x)*smoothstep(0.,.2,1.-vUv.x)*smoothstep(0.,.2,vUv.y)*smoothstep(0.,.2,1.-vUv.y);
    float density=smoothstep(.3,.7,n)*edge*uOpacity*.09;gl_FragColor=vec4(.12,.19,.23,density);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }
  `});
  const sheets=[];
  for(let i=0;i<8;i++){
    const mist=new THREE.Mesh(new THREE.PlaneGeometry(25,18),mistMaterial);mist.rotation.set(-Math.PI/2,0,(i-4)*.06);mist.position.set(0,.16+i*.115,1.6);mist.renderOrder=3+i;scene.add(mist);sheets.push(mist);
  }
  return {mistMaterial,sheets};
}

export function buildParticles(scene,textures){
  const count=150,positions=new Float32Array(count*3),seeds=[];
  for(let i=0;i<count;i++){seeds.push({x:range(-10,10),z:range(-7,9),height:range(.4,3.5),phase:range(0,6.28),speed:range(.15,.45)});}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const fireflies=new THREE.Points(geometry,new THREE.PointsMaterial({map:textures.glow,color:'#ffe3a5',size:.12,transparent:true,opacity:.82,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(fireflies);
  const petalsCount=110,petalPositions=new Float32Array(petalsCount*3),petalSeeds=[];
  for(let i=0;i<petalsCount;i++)petalSeeds.push({x:range(-5,.9),z:range(-9,-4),y:range(0,5),speed:range(.2,.45),phase:range(0,6.28)});
  const petalGeometry=new THREE.BufferGeometry();petalGeometry.setAttribute('position',new THREE.BufferAttribute(petalPositions,3));
  const petals=new THREE.Points(petalGeometry,new THREE.PointsMaterial({color:'#e9c890',size:.045,transparent:true,opacity:.75,depthWrite:false}));scene.add(petals);
  function update(time){
    for(let i=0;i<count;i++){
      const s=seeds[i];positions[i*3]=s.x+Math.sin(time*s.speed+s.phase)*.45;positions[i*3+1]=s.height+Math.sin(time*.65+s.phase)*.23;positions[i*3+2]=s.z+Math.cos(time*s.speed+s.phase)*.5;
    }geometry.attributes.position.needsUpdate=true;
    for(let i=0;i<petalsCount;i++){
      const s=petalSeeds[i];petalPositions[i*3]=s.x+Math.sin(time*.42+s.phase)*.55;petalPositions[i*3+1]=5.5-((time*s.speed+s.y)%5.4);petalPositions[i*3+2]=s.z+Math.sin(time*.23+s.phase)*.6;
    }petalGeometry.attributes.position.needsUpdate=true;
  }
  update(0);
  return {update,fireflies,petals,count,petalsCount};
}

export function buildRipples(scene){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:{value:0},uBorn:{value:0},uStrength:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
    varying vec2 vUv;uniform float uTime,uBorn,uStrength;
    void main(){float age=uTime-uBorn;float d=length(vUv-.5)*8.;float wave=sin(d*22.-age*4.);float front=1.-smoothstep(age*.55-.16,age*.55+.16,d);float back=smoothstep(age*.55-1.3,age*.55-.3,d);float a=pow(max(wave,0.),8.)*front*back*max(0.,1.-age/5.)*.24*uStrength;gl_FragColor=vec4(.54,.68,.73,a);}
  `});
  const ripples=[];
  for(let i=0;i<5;i++){const ring=new THREE.Mesh(new THREE.PlaneGeometry(8,8),material.clone());ring.rotation.x=-Math.PI/2;ring.position.y=.028;scene.add(ring);ripples.push(ring);}
  let next=0;
  return {ripples,trigger(x,z,time){const slot=next++%ripples.length,ring=ripples[slot];ring.position.set(x,.028,z);ring.material.uniforms.uBorn.value=time;ring.material.uniforms.uStrength.value=1;return slot;},update(time){ripples.forEach(r=>r.material.uniforms.uTime.value=time);}};
}
