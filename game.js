import * as THREE from 'three';

const $ = id => document.getElementById(id);
const gameEl = $('game'), hud = $('hud'), startScreen = $('startScreen');

const state = {
  running:false, paused:false, wave:1, score:0, hp:100, maxHp:100,
  ammo:30, mag:30, reserve:180, damage:34, fireRate:115, lastShot:0,
  reloadMs:1250, reloading:false, moveSpeed:5.6,
  yaw:0, pitch:0, zombies:[], kills:0, combo:0, comboUntil:0,
  headshotMult:2.4, waveAlive:0, between:false,
  fov:72, targetFov:72
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121923);
scene.fog = new THREE.FogExp2(0x131b25, 0.0155);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 120);
camera.position.set(0, 1.7, 7);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
gameEl.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xb8d2ff, 0x3c241d, 1.7); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xc4dcff, 2.25); moon.position.set(-8,16,6); moon.castShadow=true; moon.shadow.mapSize.set(1024,1024); scene.add(moon);
const warm = new THREE.PointLight(0xff5b32, 45, 22, 2); warm.position.set(0,3,-11); scene.add(warm);
const sideLight = new THREE.PointLight(0x6597ff, 34, 20, 2); sideLight.position.set(-12,2,3); scene.add(sideLight);

const flashlight = new THREE.SpotLight(0xffffff, 150, 36, Math.PI/4.8, .78, 1.45);
flashlight.castShadow = false;
flashlight.position.set(.16,-.08,-.05);
flashlight.target.position.set(0,0,-7);
camera.add(flashlight, flashlight.target); scene.add(camera);

const matFloor = new THREE.MeshStandardMaterial({ color:0x28313c, roughness:.82, metalness:.06 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(62,62), matFloor);
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

const walls = [];
function box(x,y,z,w,h,d,color=0x3c4551,emissive=0x000000){
  const m = new THREE.MeshStandardMaterial({ color, roughness:.76, metalness:.05, emissive, emissiveIntensity:.35 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  walls.push({mesh,w,h,d}); return mesh;
}
box(0,2,-24,40,4,1); box(0,2,24,40,4,1); box(-20,2,0,1,4,49); box(20,2,0,1,4,49);
box(-8,2,-8,1,4,18); box(8,2,8,1,4,18); box(0,2,0,12,4,1);
box(-14,2,9,1,4,14); box(14,2,-9,1,4,14);
box(-7,1,-17,7,2,1,0x46505c); box(8,1,17,8,2,1,0x46505c);

for(let i=-16;i<=16;i+=8){
  const color = i%16===0 ? 0xff472d : 0x4b82ff;
  const l = new THREE.PointLight(color, 24, 12, 2); l.position.set(i,2.6,-22); scene.add(l);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.4), new THREE.MeshStandardMaterial({color:0xffffff,emissive:color,emissiveIntensity:6}));
  lamp.position.copy(l.position); scene.add(lamp);
}

const weapon = new THREE.Group(); camera.add(weapon); weapon.position.set(.36,-.34,-.72);
const gunMat = new THREE.MeshStandardMaterial({ color:0x171a1e, metalness:.7, roughness:.3 });
const barrel = new THREE.Mesh(new THREE.BoxGeometry(.15,.13,.72),gunMat); barrel.position.z=-.20; weapon.add(barrel);
const body = new THREE.Mesh(new THREE.BoxGeometry(.28,.25,.5),gunMat); body.position.set(0,-.02,.13); weapon.add(body);
const mag = new THREE.Mesh(new THREE.BoxGeometry(.16,.34,.18),new THREE.MeshStandardMaterial({color:0x0b0c0e,metalness:.45,roughness:.4})); mag.position.set(0,-.26,.2); mag.rotation.x=-.13; weapon.add(mag);
const sight = new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.2),new THREE.MeshStandardMaterial({color:0x262a2f,emissive:0xff3311,emissiveIntensity:.7})); sight.position.set(0,.15,-.02); weapon.add(sight);
const muzzleLight = new THREE.PointLight(0xffa43a,0,5,2); muzzleLight.position.set(0,.02,-.63); weapon.add(muzzleLight);

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

const crosshair = document.createElement('div');
crosshair.className='crosshair';
crosshair.innerHTML='<i></i><i></i><i></i><i></i>';
hud.appendChild(crosshair);

function synth(type='shot'){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!synth.ctx) synth.ctx=new AC();
    const c=synth.ctx; if(c.state==='suspended') c.resume();
    const o=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter();
    o.connect(f); f.connect(g); g.connect(c.destination);
    const t=c.currentTime;
    if(type==='shot'){
      o.type='sawtooth'; o.frequency.setValueAtTime(105,t); o.frequency.exponentialRampToValueAtTime(42,t+.09);
      f.type='lowpass'; f.frequency.value=1050; g.gain.setValueAtTime(.2,t); g.gain.exponentialRampToValueAtTime(.001,t+.12);
    }else if(type==='head'){
      o.type='square'; o.frequency.setValueAtTime(780,t); o.frequency.exponentialRampToValueAtTime(180,t+.13);
      f.type='bandpass'; f.frequency.value=950; g.gain.setValueAtTime(.1,t); g.gain.exponentialRampToValueAtTime(.001,t+.16);
    }else{
      o.type='sine'; o.frequency.value=110; g.gain.setValueAtTime(.05,t); g.gain.exponentialRampToValueAtTime(.001,t+.18);
    }
    o.start(t); o.stop(t+.2);
  }catch{}
}
function vibrate(ms){ if(navigator.vibrate) navigator.vibrate(ms); }

const zombieGeo = new THREE.CapsuleGeometry(.48,.85,5,9);
function spawnZombie(type='normal'){
  const mat = new THREE.MeshStandardMaterial({
    color:type==='boss'?0x791b24:type==='brute'?0x52663a:0x59695d,
    roughness:.88, emissive:type==='boss'?0x350008:0x071108, emissiveIntensity:.42
  });
  const mesh = new THREE.Mesh(zombieGeo,mat); mesh.castShadow=true;
  let p, tries=0;
  do{
    const a=Math.random()*Math.PI*2, r=15+Math.random()*6;
    p=new THREE.Vector3(Math.cos(a)*r,1.05,Math.sin(a)*r); tries++;
  }while(collides(p,.7)&&tries<12);
  mesh.position.copy(p); scene.add(mesh);
  const hp=(type==='boss'?380:type==='brute'?150:80)*(1+(state.wave-1)*.11);
  const z={mesh,type,hp,maxHp:hp,speed:(type==='boss'?1.25:type==='brute'?1.1:1.65)*(1+Math.min(.5,state.wave*.025)),attack:0,dead:false,stagger:0,phase:Math.random()*10};
  state.zombies.push(z); state.waveAlive++; updateHud(); return z;
}
function startWave(){
  state.between=false; $('upgradePanel').classList.add('hidden');
  const banner=$('roundBanner'); banner.querySelector('strong').textContent=state.wave; banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
  const count=Math.min(6+state.wave*2,32);
  for(let i=0;i<count;i++) setTimeout(()=>state.running&&spawnZombie(state.wave%5===0&&i===count-1?'boss':(Math.random()<.12?'brute':'normal')),i*250);
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
  const cards=$('upgradeCards'); cards.innerHTML='';
  for(const [n,d,fn] of pool){
    const b=document.createElement('button'); b.className='upgradeCard'; b.innerHTML=`<em>UPGRADE</em><b>${n}</b><span>${d}</span>`;
    b.onclick=()=>{fn();state.wave++;startWave()}; cards.appendChild(b);
  }
  $('upgradePanel').classList.remove('hidden');
}
function killZombie(z,head){
  if(z.dead)return; z.dead=true; z.mesh.material.emissive.set(head?0xff3600:0x250000); z.mesh.material.emissiveIntensity=2.8;
  state.kills++; state.waveAlive--; state.combo++; state.comboUntil=performance.now()+1800;
  const gain=(head?180:100)*Math.max(1,state.combo); state.score+=gain;
  z.mesh.scale.y=.86; z.mesh.rotation.x=head?-.3:.12;
  if(head){showHead();synth('head');vibrate([15,18,35]);}
  setTimeout(()=>{
    scene.remove(z.mesh); state.zombies=state.zombies.filter(q=>q!==z);
    if(state.waveAlive<=0&&!state.between)setTimeout(chooseUpgrade,650);
  },210);
  updateHud();
}
function showHit(head=false){
  const h=$('hitmarker'); h.classList.toggle('head',head); h.classList.add('show');
  crosshair.classList.add(head?'head':'hit');
  clearTimeout(showHit.t); showHit.t=setTimeout(()=>{h.classList.remove('show');crosshair.classList.remove('hit','head')},95);
}
function showHead(){const h=$('headshot');h.classList.remove('show');void h.offsetWidth;h.classList.add('show')}
function shoot(){
  const now=performance.now();
  if(!state.running||state.paused||state.reloading||now-state.lastShot<state.fireRate)return;
  if(state.ammo<=0){reload();return}
  state.lastShot=now; state.ammo--; synth('shot'); vibrate(10);
  muzzleLight.intensity=140; setTimeout(()=>muzzleLight.intensity=0,34);
  weapon.userData.kick=.13; state.pitch=Math.min(.92,state.pitch+.014);
  crosshair.classList.add('fire'); setTimeout(()=>crosshair.classList.remove('fire'),75);
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const live=state.zombies.filter(z=>!z.dead).map(z=>z.mesh);
  const hits=raycaster.intersectObjects(live,false);
  if(hits.length){
    const hit=hits[0], z=state.zombies.find(q=>q.mesh===hit.object);
    const localY=hit.point.y-z.mesh.position.y;
    const head=localY>.48;
    z.hp-=state.damage*(head?state.headshotMult:1); z.stagger=head?.18:.1;
    showHit(head);
    if(z.hp<=0)killZombie(z,head);
  }
  updateHud();
}
function reload(){
  if(state.reloading||state.ammo===state.mag||state.reserve<=0)return;
  state.reloading=true; synth('reload');
  setTimeout(()=>{
    const need=state.mag-state.ammo,take=Math.min(need,state.reserve);
    state.ammo+=take; state.reserve-=take; state.reloading=false; updateHud();
  },state.reloadMs);
}
function damagePlayer(n){
  if(!state.running)return;
  state.hp-=n; $('damageFlash').style.opacity=.85; setTimeout(()=>$('damageFlash').style.opacity=0,100); vibrate(25);
  if(state.hp<=0){
    state.hp=0; state.running=false; resetJoystick();
    startScreen.classList.remove('hidden'); hud.classList.add('hidden');
    startScreen.querySelector('p').innerHTML=`Partie terminée — Score <b>${Math.floor(state.score)}</b><br>Appuie pour recommencer.`;
    $('startBtn').textContent='REJOUER';
  }
  updateHud();
}
function updateHud(){
  $('wave').textContent=state.wave; $('score').textContent=Math.floor(state.score); $('remaining').textContent=state.waveAlive;
  $('ammo').textContent=state.ammo; $('reserve').textContent=state.reserve; $('healthText').textContent=Math.ceil(state.hp);
  $('healthFill').style.width=`${Math.max(0,state.hp/state.maxHp*100)}%`;
}

// Robust mobile input: floating joystick + global pointer tracking + touch fallback.
const input={jx:0,jy:0,targetX:0,targetY:0,lookId:null,joyId:null,fire:false,keys:new Set()};
const joy=$('joystick'), stick=$('stick'), lookZone=$('lookZone');
let joyCenter={x:0,y:0}, lx=0,ly=0;

function placeJoystick(x,y){
  const radius=66;
  const cx=THREE.MathUtils.clamp(x,radius+10,innerWidth*.45-radius);
  const cy=THREE.MathUtils.clamp(y,innerHeight*.34+radius,innerHeight-radius-10);
  joyCenter={x:cx,y:cy};
  joy.style.left=`${cx-radius}px`; joy.style.top=`${cy-radius}px`; joy.style.bottom='auto';
  joy.classList.add('active');
}
function joystickAt(x,y){
  const max=43, dx0=x-joyCenter.x, dy0=y-joyCenter.y, len=Math.hypot(dx0,dy0)||1;
  const scale=Math.min(1,max/len), dx=dx0*scale, dy=dy0*scale;
  stick.style.transform=`translate(${dx}px,${dy}px)`;
  const dead=.08;
  const nx=dx/max, ny=dy/max;
  input.targetX=Math.abs(nx)<dead?0:nx;
  input.targetY=Math.abs(ny)<dead?0:ny;
}
function beginJoystick(id,x,y,e){
  if(input.joyId!==null||state.between||!state.running)return;
  input.joyId=id; placeJoystick(x,y); joystickAt(x,y);
  if(e?.cancelable)e.preventDefault();
}
function moveJoystick(id,x,y,e){
  if(id!==input.joyId)return;
  joystickAt(x,y); if(e?.cancelable)e.preventDefault();
}
function resetJoystick(id=null){
  if(id!==null&&id!==input.joyId)return;
  input.joyId=null; input.targetX=input.targetY=0;
  stick.style.transform='translate(0px,0px)'; joy.classList.remove('active');
}
function isLeftMoveArea(x,y,target){
  if(!state.running||state.between)return false;
  if(target?.closest?.('button,.upgradePanel'))return false;
  return x<innerWidth*.46 && y>innerHeight*.25;
}

// Capture at document level so iOS cannot lose the joystick when the finger leaves the circle.
document.addEventListener('pointerdown',e=>{
  if(isLeftMoveArea(e.clientX,e.clientY,e.target)){
    beginJoystick(e.pointerId,e.clientX,e.clientY,e);
    try{e.target.setPointerCapture?.(e.pointerId)}catch{}
  }
},{capture:true});
document.addEventListener('pointermove',e=>moveJoystick(e.pointerId,e.clientX,e.clientY,e),{capture:true});
document.addEventListener('pointerup',e=>resetJoystick(e.pointerId),{capture:true});
document.addEventListener('pointercancel',e=>resetJoystick(e.pointerId),{capture:true});

// Fallback for older/quirky iOS WebViews.
if(!('PointerEvent' in window)){
  document.addEventListener('touchstart',e=>{
    for(const t of e.changedTouches){if(isLeftMoveArea(t.clientX,t.clientY,e.target)){beginJoystick(t.identifier,t.clientX,t.clientY,e);break}}
  },{passive:false,capture:true});
  document.addEventListener('touchmove',e=>{
    for(const t of e.changedTouches)moveJoystick(t.identifier,t.clientX,t.clientY,e);
  },{passive:false,capture:true});
  document.addEventListener('touchend',e=>{for(const t of e.changedTouches)resetJoystick(t.identifier)},{passive:false,capture:true});
  document.addEventListener('touchcancel',e=>{for(const t of e.changedTouches)resetJoystick(t.identifier)},{passive:false,capture:true});
}

lookZone.addEventListener('pointerdown',e=>{
  if(input.lookId!==null)return;
  input.lookId=e.pointerId; lx=e.clientX; ly=e.clientY;
  try{lookZone.setPointerCapture(e.pointerId)}catch{}
});
lookZone.addEventListener('pointermove',e=>{
  if(e.pointerId!==input.lookId)return;
  const dx=e.clientX-lx,dy=e.clientY-ly; lx=e.clientX;ly=e.clientY;
  state.yaw-=dx*.00425; state.pitch-=dy*.00375; state.pitch=THREE.MathUtils.clamp(state.pitch,-1.05,1.05);
});
lookZone.addEventListener('pointerup',e=>{if(e.pointerId===input.lookId)input.lookId=null});
lookZone.addEventListener('pointercancel',e=>{if(e.pointerId===input.lookId)input.lookId=null});

$('fireBtn').addEventListener('pointerdown',e=>{input.fire=true;shoot();try{$('fireBtn').setPointerCapture(e.pointerId)}catch{}});
$('fireBtn').addEventListener('pointerup',()=>input.fire=false);
$('fireBtn').addEventListener('pointercancel',()=>input.fire=false);
$('reloadBtn').onclick=reload;

addEventListener('keydown',e=>{input.keys.add(e.code);if(e.code==='KeyR')reload()});
addEventListener('keyup',e=>input.keys.delete(e.code));

function collides(pos,radius=.38){
  for(const w of walls){
    const p=w.mesh.position;
    if(Math.abs(pos.x-p.x)<w.w/2+radius && Math.abs(pos.z-p.z)<w.d/2+radius)return true;
  }
  return false;
}
function updatePlayer(dt){
  camera.rotation.order='YXZ'; camera.rotation.y=state.yaw; camera.rotation.x=state.pitch;

  // Smooth analog response instead of instant digital-feeling motion.
  const accel=Math.min(1,dt*14);
  input.jx=THREE.MathUtils.lerp(input.jx,input.targetX,accel);
  input.jy=THREE.MathUtils.lerp(input.jy,input.targetY,accel);
  if(Math.abs(input.jx)<.005)input.jx=0;if(Math.abs(input.jy)<.005)input.jy=0;

  let kx=0,ky=0;
  if(input.keys.has('KeyA')||input.keys.has('ArrowLeft'))kx-=1;
  if(input.keys.has('KeyD')||input.keys.has('ArrowRight'))kx+=1;
  if(input.keys.has('KeyW')||input.keys.has('ArrowUp'))ky-=1;
  if(input.keys.has('KeyS')||input.keys.has('ArrowDown'))ky+=1;

  const ix=THREE.MathUtils.clamp(input.jx+kx,-1,1), iy=THREE.MathUtils.clamp(input.jy+ky,-1,1);
  const magnitude=Math.min(1,Math.hypot(ix,iy));
  const fwd=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));
  const right=new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw));
  const move=fwd.multiplyScalar(-iy).add(right.multiplyScalar(ix));
  if(move.lengthSq()>1)move.normalize();

  const sprint=magnitude>.82?1.34:1;
  const step=state.moveSpeed*sprint*dt;
  const delta=move.multiplyScalar(step);

  // Axis-separated collision allows wall sliding instead of freezing the whole movement vector.
  const px=camera.position.clone(); px.x+=delta.x; px.y=1.7;
  if(!collides(px))camera.position.x=px.x;
  const pz=camera.position.clone(); pz.z+=delta.z; pz.y=1.7;
  if(!collides(pz))camera.position.z=pz.z;

  state.targetFov=sprint>1?78:72;
  state.fov=THREE.MathUtils.lerp(state.fov,state.targetFov,Math.min(1,dt*6));
  if(Math.abs(camera.fov-state.fov)>.03){camera.fov=state.fov;camera.updateProjectionMatrix()}

  const speed=magnitude*sprint, t=performance.now()*.0075;
  const bob=speed>0.04?1:0;
  weapon.position.x=.36+Math.sin(t)*.016*speed*bob;
  weapon.position.y=-.34-Math.abs(Math.cos(t))* .015*speed*bob;
  camera.position.y=1.7+(bob?Math.sin(t*2)*.009*speed:0);

  const kick=weapon.userData.kick||0;
  weapon.position.z=-.72+kick; weapon.rotation.x=-kick*1.85;
  weapon.userData.kick=THREE.MathUtils.lerp(kick,0,Math.min(1,dt*20));
  if(state.reloading)weapon.rotation.z=Math.sin(performance.now()/state.reloadMs*Math.PI)*-.75;
  else weapon.rotation.z=THREE.MathUtils.lerp(weapon.rotation.z,0,dt*9);
}
function updateZombies(dt){
  for(let i=0;i<state.zombies.length;i++){
    const z=state.zombies[i]; if(z.dead)continue;
    const p=z.mesh.position,target=camera.position.clone();target.y=p.y;
    const dist=p.distanceTo(target); const dir=target.sub(p).normalize();
    if(z.stagger>0){z.stagger-=dt;continue}

    // Light separation so hordes do not collapse into one capsule.
    for(let j=0;j<state.zombies.length;j++){
      if(i===j)continue; const o=state.zombies[j]; if(o.dead)continue;
      const d=p.distanceTo(o.mesh.position);
      if(d>0&&d<.9){const away=p.clone().sub(o.mesh.position).normalize();dir.addScaledVector(away,(.9-d)*.6)}
    }
    dir.normalize();

    if(dist>1.15){
      const next=p.clone().addScaledVector(dir,z.speed*dt);
      if(!collides(next,.45))p.copy(next);
      else{
        const left=dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),.9);
        const alt=p.clone().addScaledVector(left,z.speed*.7*dt);
        if(!collides(alt,.45))p.copy(alt);
      }
      z.mesh.lookAt(camera.position.x,p.y,camera.position.z);
      z.mesh.rotation.z=Math.sin(performance.now()*.006+z.phase)*.035;
      z.mesh.position.y=1.05+Math.abs(Math.sin(performance.now()*.004+z.phase))*.035;
    }else{
      z.attack-=dt;
      if(z.attack<=0){z.attack=.72+Math.random()*.25;damagePlayer(z.type==='boss'?24:z.type==='brute'?17:11)}
    }
  }
}
function updateCombo(){
  if(state.combo&&performance.now()>state.comboUntil)state.combo=0;
  $('combo').textContent=state.combo>=2?`×${state.combo} COMBO`:'';
}
function loop(){
  requestAnimationFrame(loop); const dt=Math.min(.033,clock.getDelta());
  if(state.running&&!state.paused&&!state.between){if(input.fire)shoot();updatePlayer(dt);updateZombies(dt);updateCombo()}
  renderer.render(scene,camera);
}
loop();

function reset(){
  for(const z of state.zombies)scene.remove(z.mesh);
  Object.assign(state,{running:true,paused:false,wave:1,score:0,hp:100,maxHp:100,ammo:30,mag:30,reserve:180,damage:34,fireRate:115,lastShot:0,reloadMs:1250,reloading:false,moveSpeed:5.6,yaw:0,pitch:0,zombies:[],kills:0,combo:0,waveAlive:0,between:false,headshotMult:2.4,fov:72,targetFov:72});
  input.jx=input.jy=input.targetX=input.targetY=0; input.fire=false; input.keys.clear(); resetJoystick();
  camera.position.set(0,1.7,7); camera.fov=72; camera.updateProjectionMatrix(); updateHud(); startWave();
}
$('startBtn').onclick=async()=>{
  try{await document.documentElement.requestFullscreen?.()}catch{}
  startScreen.classList.add('hidden'); hud.classList.remove('hidden'); reset();
};
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.55));
  if(input.joyId!==null)resetJoystick();
});
document.addEventListener('visibilitychange',()=>{state.paused=document.hidden;if(document.hidden)resetJoystick()});
