import * as THREE from 'three';

const $ = id => document.getElementById(id);
const gameEl=$('game'), hud=$('hud'), startScreen=$('startScreen');

const state={
  running:false, paused:false, wave:1, score:0, hp:100, maxHp:100,
  ammo:30, mag:30, reserve:180, damage:34, fireRate:115, lastShot:0,
  reloadMs:1250, reloading:false, moveSpeed:5.6, sprint:1,
  yaw:0, pitch:0, zombies:[], kills:0, combo:0, comboUntil:0,
  headshotMult:2.4, waveAlive:0, between:false
};

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x10151d);
scene.fog=new THREE.FogExp2(0x111923,0.018);

const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,120);
camera.position.set(0,1.7,7);

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.35;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
gameEl.appendChild(renderer.domElement);

const hemi=new THREE.HemisphereLight(0xa9c9ff,0x321b16,1.45);scene.add(hemi);
const moon=new THREE.DirectionalLight(0xbdd8ff,2.0);moon.position.set(-8,16,6);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);scene.add(moon);
const warm=new THREE.PointLight(0xff5128,38,20,2);warm.position.set(0,3,-11);scene.add(warm);
const sideLight=new THREE.PointLight(0x5b88ff,25,18,2);sideLight.position.set(-12,2,3);scene.add(sideLight);

const flashlight=new THREE.SpotLight(0xffffff,120,32,Math.PI/5.2,.75,1.6);
flashlight.castShadow=false;
flashlight.position.set(.16,-.08,-.05);
flashlight.target.position.set(0,0,-6);
camera.add(flashlight,flashlight.target);scene.add(camera);

const matFloor=new THREE.MeshStandardMaterial({color:0x222832,roughness:.82,metalness:.06});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(62,62),matFloor);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

const walls=[];
function box(x,y,z,w,h,d,color=0x343a45, emissive=0x000000){
  const m=new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.05,emissive,emissiveIntensity:.35});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);walls.push({mesh,w,h,d});return mesh;
}
box(0,2,-24,40,4,1);box(0,2,24,40,4,1);box(-20,2,0,1,4,49);box(20,2,0,1,4,49);
box(-8,2,-8,1,4,18);box(8,2,8,1,4,18);box(0,2,0,12,4,1);
box(-14,2,9,1,4,14);box(14,2,-9,1,4,14);
box(-7,1,-17,7,2,1,0x3b424d);box(8,1,17,8,2,1,0x3b424d);

for(let i=-16;i<=16;i+=8){
  const l=new THREE.PointLight(i%16===0?0xff3d26:0x3d7cff,18,10,2);
  l.position.set(i,2.6,-22);scene.add(l);
  const lamp=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.4),new THREE.MeshStandardMaterial({color:0xffffff,emissive:i%16===0?0xff3d26:0x3d7cff,emissiveIntensity:5}));
  lamp.position.copy(l.position);scene.add(lamp);
}

const weapon=new THREE.Group();camera.add(weapon);weapon.position.set(.36,-.34,-.72);
const gunMat=new THREE.MeshStandardMaterial({color:0x171a1e,metalness:.7,roughness:.3});
const barrel=new THREE.Mesh(new THREE.BoxGeometry(.15,.13,.72),gunMat);barrel.position.z=-.20;weapon.add(barrel);
const body=new THREE.Mesh(new THREE.BoxGeometry(.28,.25,.5),gunMat);body.position.set(0,-.02,.13);weapon.add(body);
const mag=new THREE.Mesh(new THREE.BoxGeometry(.16,.34,.18),new THREE.MeshStandardMaterial({color:0x0b0c0e,metalness:.45,roughness:.4}));mag.position.set(0,-.26,.2);mag.rotation.x=-.13;weapon.add(mag);
const sight=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.2),new THREE.MeshStandardMaterial({color:0x262a2f,emissive:0xff3311,emissiveIntensity:.5}));sight.position.set(0,.15,-.02);weapon.add(sight);
const muzzleLight=new THREE.PointLight(0xffa43a,0,4,2);muzzleLight.position.set(0,.02,-.63);weapon.add(muzzleLight);

const raycaster=new THREE.Raycaster();
const clock=new THREE.Clock();

function synth(type='shot'){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!synth.ctx) synth.ctx=new AC();
    const c=synth.ctx; if(c.state==='suspended')c.resume();
    const o=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter();
    o.connect(f);f.connect(g);g.connect(c.destination);
    const t=c.currentTime;
    if(type==='shot'){o.type='sawtooth';o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(45,t+.08);f.type='lowpass';f.frequency.value=850;g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.001,t+.11)}
    else if(type==='head'){o.type='square';o.frequency.setValueAtTime(720,t);o.frequency.exponentialRampToValueAtTime(170,t+.12);f.type='bandpass';f.frequency.value=900;g.gain.setValueAtTime(.09,t);g.gain.exponentialRampToValueAtTime(.001,t+.15)}
    else{o.type='sine';o.frequency.value=110;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+.18)}
    o.start(t);o.stop(t+.2);
  }catch{}
}
function vibrate(ms){ if(navigator.vibrate) navigator.vibrate(ms); }

const zombieGeo=new THREE.CapsuleGeometry(.48,.85,5,9);
function spawnZombie(type='normal'){
  const mat=new THREE.MeshStandardMaterial({color:type==='boss'?0x6e1720:type==='brute'?0x42572c:0x4e5c52,roughness:.88,emissive:type==='boss'?0x310007:0x071008,emissiveIntensity:.35});
  const mesh=new THREE.Mesh(zombieGeo,mat);mesh.castShadow=true;
  const a=Math.random()*Math.PI*2, r=16+Math.random()*5;
  mesh.position.set(Math.cos(a)*r,1.05,Math.sin(a)*r);
  scene.add(mesh);
  const hp=(type==='boss'?380:type==='brute'?150:80)*(1+(state.wave-1)*.11);
  const z={mesh,type,hp,maxHp:hp,speed:(type==='boss'?1.25:type==='brute'?1.1:1.65)*(1+Math.min(.5,state.wave*.025)),attack:0,dead:false,stagger:0};
  state.zombies.push(z);state.waveAlive++; updateHud(); return z;
}
function startWave(){
  state.between=false;
  $('upgradePanel').classList.add('hidden');
  const banner=$('roundBanner');banner.querySelector('strong').textContent=state.wave;banner.classList.remove('show');void banner.offsetWidth;banner.classList.add('show');
  const count=Math.min(6+state.wave*2,32);
  for(let i=0;i<count;i++) setTimeout(()=>state.running&&spawnZombie(state.wave%5===0&&i===count-1?'boss':(Math.random()<.12?'brute':'normal')),i*260);
}
function chooseUpgrade(){
  state.between=true;
  const pool=[
    ['HIGH CALIBER','+22% dégâts',()=>state.damage*=1.22],
    ['FAST MAG','Recharge -20%',()=>state.reloadMs*=.8],
    ['EXTENDED MAG','Chargeur +8',()=>{state.mag+=8;state.ammo=state.mag}],
    ['STIM','PV max +25',()=>{state.maxHp+=25;state.hp=state.maxHp}],
    ['RUNNER','Vitesse +12%',()=>state.moveSpeed*=1.12],
    ['DEADEYE','Headshots +25%',()=>state.headshotMult*=1.25]
  ].sort(()=>Math.random()-.5).slice(0,3);
  const cards=$('upgradeCards');cards.innerHTML='';
  for(const [n,d,fn] of pool){
    const b=document.createElement('button');b.className='upgradeCard';b.innerHTML=`<em>UPGRADE</em><b>${n}</b><span>${d}</span>`;
    b.onclick=()=>{fn();state.wave++;startWave()};cards.appendChild(b);
  }
  $('upgradePanel').classList.remove('hidden');
}
function killZombie(z,head){
  if(z.dead)return;z.dead=true;z.mesh.material.emissive.set(head?0xff3000:0x220000);z.mesh.material.emissiveIntensity=2.5;
  state.kills++;state.waveAlive--;state.combo++;state.comboUntil=performance.now()+1800;
  const gain=(head?180:100)*Math.max(1,state.combo);state.score+=gain;
  if(head){showHead();synth('head');vibrate([15,18,35]);}
  setTimeout(()=>{scene.remove(z.mesh);state.zombies=state.zombies.filter(q=>q!==z);if(state.waveAlive<=0&&!state.between)setTimeout(chooseUpgrade,700)},220);
  updateHud();
}
function showHit(head=false){
  const h=$('hitmarker');h.classList.toggle('head',head);h.classList.add('show');clearTimeout(showHit.t);showHit.t=setTimeout(()=>h.classList.remove('show'),90);
}
function showHead(){const h=$('headshot');h.classList.remove('show');void h.offsetWidth;h.classList.add('show')}
function shoot(){
  const now=performance.now();if(!state.running||state.paused||state.reloading||now-state.lastShot<state.fireRate)return;
  if(state.ammo<=0){reload();return}
  state.lastShot=now;state.ammo--;synth('shot');vibrate(10);
  muzzleLight.intensity=110;setTimeout(()=>muzzleLight.intensity=0,38);
  weapon.userData.kick=.11;state.pitch=Math.min(.9,state.pitch+.012);
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const live=state.zombies.filter(z=>!z.dead).map(z=>z.mesh);
  const hits=raycaster.intersectObjects(live,false);
  if(hits.length){
    const hit=hits[0], z=state.zombies.find(q=>q.mesh===hit.object);
    const localY=hit.point.y-z.mesh.position.y;
    const head=localY>.48;
    z.hp-=state.damage*(head?state.headshotMult:1);z.stagger=.12;
    showHit(head);
    if(z.hp<=0)killZombie(z,head);
  }
  updateHud();
}
function reload(){
  if(state.reloading||state.ammo===state.mag||state.reserve<=0)return;
  state.reloading=true;
  weapon.userData.reloadT=0;
  setTimeout(()=>{const need=state.mag-state.ammo,take=Math.min(need,state.reserve);state.ammo+=take;state.reserve-=take;state.reloading=false;updateHud()},state.reloadMs);
}
function damagePlayer(n){
  if(!state.running)return;state.hp-=n;$('damageFlash').style.opacity=.8;setTimeout(()=>$('damageFlash').style.opacity=0,90);vibrate(25);
  if(state.hp<=0){
    state.hp=0;state.running=false;startScreen.classList.remove('hidden');hud.classList.add('hidden');
    startScreen.querySelector('p').innerHTML=`Partie terminée — Score <b>${Math.floor(state.score)}</b><br>Appuie pour recommencer.`;
    $('startBtn').textContent='REJOUER';
  } updateHud();
}
function updateHud(){
  $('wave').textContent=state.wave;$('score').textContent=Math.floor(state.score);$('remaining').textContent=state.waveAlive;
  $('ammo').textContent=state.ammo;$('reserve').textContent=state.reserve;$('healthText').textContent=Math.ceil(state.hp);
  $('healthFill').style.width=`${Math.max(0,state.hp/state.maxHp*100)}%`;
}

const input={jx:0,jy:0,lookId:null,joyId:null,fire:false};
const joy=$('joystick'),stick=$('stick');
function joystickAt(x,y){
  const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=x-cx,dy=y-cy,max=38,l=Math.hypot(dx,dy)||1,s=Math.min(1,max/l);
  dx*=s;dy*=s;stick.style.transform=`translate(${dx}px,${dy}px)`;input.jx=dx/max;input.jy=dy/max;
}
joy.addEventListener('pointerdown',e=>{input.joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joystickAt(e.clientX,e.clientY)});
joy.addEventListener('pointermove',e=>{if(e.pointerId===input.joyId)joystickAt(e.clientX,e.clientY)});
joy.addEventListener('pointerup',e=>{if(e.pointerId===input.joyId){input.joyId=null;input.jx=input.jy=0;stick.style.transform=''}});
let lx=0,ly=0;
$('lookZone').addEventListener('pointerdown',e=>{input.lookId=e.pointerId;lx=e.clientX;ly=e.clientY;$('lookZone').setPointerCapture(e.pointerId)});
$('lookZone').addEventListener('pointermove',e=>{if(e.pointerId!==input.lookId)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;state.yaw-=dx*.0042;state.pitch-=dy*.0037;state.pitch=THREE.MathUtils.clamp(state.pitch,-1.05,1.05)});
$('lookZone').addEventListener('pointerup',e=>{if(e.pointerId===input.lookId)input.lookId=null});
$('fireBtn').addEventListener('pointerdown',e=>{input.fire=true;shoot();$('fireBtn').setPointerCapture(e.pointerId)});
$('fireBtn').addEventListener('pointerup',()=>input.fire=false);
$('reloadBtn').onclick=reload;

function collides(pos){
  const radius=.38;
  for(const w of walls){
    const p=w.mesh.position;
    if(Math.abs(pos.x-p.x)<w.w/2+radius && Math.abs(pos.z-p.z)<w.d/2+radius)return true;
  } return false;
}
function updatePlayer(dt){
  camera.rotation.order='YXZ';camera.rotation.y=state.yaw;camera.rotation.x=state.pitch;
  const fwd=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));
  const right=new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw));
  const move=fwd.multiplyScalar(-input.jy).add(right.multiplyScalar(input.jx));
  if(move.lengthSq()>1)move.normalize();
  const np=camera.position.clone().addScaledVector(move,state.moveSpeed*dt);
  np.y=1.7;if(!collides(np))camera.position.copy(np);
  const speed=move.length();const t=performance.now()*.007;
  weapon.position.x=.36+Math.sin(t)*.012*speed;weapon.position.y=-.34+Math.abs(Math.cos(t))*-.012*speed;
  const kick=weapon.userData.kick||0;weapon.position.z=-.72+kick;weapon.rotation.x=-kick*1.8;weapon.userData.kick=THREE.MathUtils.lerp(kick,0,Math.min(1,dt*18));
  if(state.reloading){weapon.rotation.z=Math.sin(performance.now()/state.reloadMs*Math.PI)*-.75}else weapon.rotation.z=THREE.MathUtils.lerp(weapon.rotation.z,0,dt*9);
}
function updateZombies(dt){
  for(const z of state.zombies){
    if(z.dead)continue;
    const p=z.mesh.position, target=camera.position.clone();target.y=p.y;
    const dist=p.distanceTo(target);const dir=target.sub(p).normalize();
    if(z.stagger>0){z.stagger-=dt;continue}
    if(dist>1.15){
      const next=p.clone().addScaledVector(dir,z.speed*dt);
      if(!collides(next))p.copy(next); else {dir.applyAxisAngle(new THREE.Vector3(0,1,0),Math.sin(performance.now()*.002+p.x)*.85);p.addScaledVector(dir,z.speed*.6*dt)}
      z.mesh.lookAt(camera.position.x,p.y,camera.position.z);
      z.mesh.rotation.z=Math.sin(performance.now()*.006+p.x)*.025;
    }else{
      z.attack-=dt;if(z.attack<=0){z.attack=.72+(Math.random()*.25);damagePlayer(z.type==='boss'?24:z.type==='brute'?17:11)}
    }
  }
}
function updateCombo(){
  if(state.combo&&performance.now()>state.comboUntil)state.combo=0;
  $('combo').textContent=state.combo>=2?`×${state.combo} COMBO`:'';
}
function loop(){
  requestAnimationFrame(loop);const dt=Math.min(.033,clock.getDelta());
  if(state.running&&!state.paused&&!state.between){if(input.fire)shoot();updatePlayer(dt);updateZombies(dt);updateCombo()}
  renderer.render(scene,camera);
}
loop();

function reset(){
  for(const z of state.zombies)scene.remove(z.mesh);
  Object.assign(state,{running:true,paused:false,wave:1,score:0,hp:100,maxHp:100,ammo:30,mag:30,reserve:180,damage:34,fireRate:115,lastShot:0,reloadMs:1250,reloading:false,moveSpeed:5.6,yaw:0,pitch:0,zombies:[],kills:0,combo:0,waveAlive:0,between:false,headshotMult:2.4});
  camera.position.set(0,1.7,7);updateHud();startWave();
}
$('startBtn').onclick=async()=>{try{await document.documentElement.requestFullscreen?.()}catch{};startScreen.classList.add('hidden');hud.classList.remove('hidden');reset()};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.65))});
document.addEventListener('visibilitychange',()=>{state.paused=document.hidden});
