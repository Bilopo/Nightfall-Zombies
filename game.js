import * as THREE from 'three';

const $ = id => document.getElementById(id);
const hud = $('hud'), startScreen = $('startScreen'), gameEl = $('game');
const fireBtn = $('fireBtn'), reloadBtn = $('reloadBtn'), joy = $('joystick'), stick = $('stick'), lookZone = $('lookZone');

const W = {
  pistol: {name:'Viper 9', damage:42, fireRate:185, mag:12, reserve:96, reload:900, pellets:1, spread:.004, recoil:.10},
  rifle:  {name:'NX-47', damage:29, fireRate:88, mag:30, reserve:180, reload:1250, pellets:1, spread:.007, recoil:.075},
  smg:    {name:'Raze SMG', damage:23, fireRate:68, mag:36, reserve:216, reload:1100, pellets:1, spread:.011, recoil:.055},
  shotgun:{name:'Grave-12', damage:18, fireRate:520, mag:8, reserve:64, reload:1450, pellets:8, spread:.045, recoil:.20}
};

const state = {
  running:false, paused:false, between:false, wave:1, score:0, points:500,
  hp:100, maxHp:100, zombies:[], alive:0, kills:0,
  yaw:0, pitch:0, moveSpeed:5.8, fov:72, targetFov:72,
  combo:0, comboUntil:0, lastShot:0, reloading:false,
  headMult:2.5, damageMult:1, reloadMult:1,
  weaponKey:'rifle', weapon:{}, owned:['rifle'],
  perks:{iron:false,quick:false,deadeye:false,rush:false},
  waveStarted:false
};
const input = {jx:0,jy:0,tx:0,ty:0,joyId:null,lookId:null,fire:false};
let joyCenter={x:0,y:0}, lx=0, ly=0;

function cloneWeapon(k){ const b=W[k]; return {key:k,...b,ammo:b.mag,reserveAmmo:b.reserve}; }
state.weapon=cloneWeapon(state.weaponKey);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121923);
scene.fog = new THREE.FogExp2(0x131b25,.0135);

const camera = new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,140);
camera.position.set(0,1.7,8); scene.add(camera);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.45)); renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.6;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; gameEl.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc6dcff,0x40261e,1.9));
const moon=new THREE.DirectionalLight(0xd8e7ff,2.35); moon.position.set(-10,18,8); moon.castShadow=true; moon.shadow.mapSize.set(1024,1024); scene.add(moon);
for(const [x,z,c,i,d] of [[0,-13,0xff5b32,48,24],[-15,5,0x5d91ff,34,20],[15,10,0xff3c2e,26,16],[0,18,0x667dff,30,18]]){const l=new THREE.PointLight(c,i,d,2);l.position.set(x,2.8,z);scene.add(l)}
const flashlight=new THREE.SpotLight(0xffffff,175,40,Math.PI/4.5,.8,1.4); flashlight.position.set(.1,-.05,0); flashlight.target.position.set(0,0,-8); camera.add(flashlight,flashlight.target);

const floor=new THREE.Mesh(new THREE.PlaneGeometry(72,72),new THREE.MeshStandardMaterial({color:0x29333f,roughness:.84,metalness:.04})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
const walls=[];
function box(x,y,z,w,h,d,color=0x3c4653){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.05}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);walls.push({m,w,d});return m}
box(0,2,-30,50,4,1);box(0,2,30,50,4,1);box(-25,2,0,1,4,61);box(25,2,0,1,4,61);
box(-9,2,-10,1,4,20);box(9,2,10,1,4,20);box(0,2,0,14,4,1);box(-16,2,11,1,4,16);box(16,2,-11,1,4,16);
box(-6,1,-21,9,2,1,0x495461);box(8,1,21,10,2,1,0x495461);box(-18,1,-6,6,2,1,0x414b56);box(18,1,7,6,2,1,0x414b56);
for(let i=0;i<14;i++){const c=i%3===0?0x4d5226:i%3===1?0x512721:0x323944;const m=new THREE.Mesh(new THREE.CylinderGeometry(.38,.45,1.05,10),new THREE.MeshStandardMaterial({color:c,roughness:.8,metalness:.13}));m.position.set((Math.random()-.5)*38,.52,(Math.random()-.5)*38);if(!collides(m.position,.75)){m.castShadow=true;scene.add(m)}}

const gun = new THREE.Group(); camera.add(gun); gun.position.set(.36,-.34,-.72);
const gunMat=new THREE.MeshStandardMaterial({color:0x15191f,metalness:.75,roughness:.28});
const darkMat=new THREE.MeshStandardMaterial({color:0x090b0e,metalness:.52,roughness:.38});
function part(w,h,d,x,y,z,mat=gunMat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);gun.add(m);return m}
part(.17,.13,.78,0,0,-.22);part(.30,.25,.52,0,-.02,.12);part(.17,.34,.18,0,-.27,.2,darkMat);part(.08,.07,.22,0,.15,-.02,new THREE.MeshStandardMaterial({color:0x262a2f,emissive:0xff321a,emissiveIntensity:.9}));part(.11,.3,.16,0,-.2,.31);
const muzzleLight=new THREE.PointLight(0xffa43a,0,6,2);muzzleLight.position.set(0,.01,-.67);gun.add(muzzleLight);

const raycaster=new THREE.Raycaster(), clock=new THREE.Clock(), particles=[];
const cross=document.createElement('div');cross.className='crosshair';cross.innerHTML='<i></i><i></i><i></i><i></i>';hud.appendChild(cross);

const overlay=document.createElement('div');overlay.className='v5Overlay';overlay.innerHTML=`
  <div id="weaponTag" class="weaponTag"></div>
  <button id="boxBtn" class="shopBtn boxBtn">? MYSTERY 950</button>
  <button id="perkBtn" class="shopBtn perkBtn">⚡ PERKS</button>
  <button id="switchBtn" class="shopBtn switchBtn">⇄ WEAPON</button>
  <div id="shopPanel" class="shopPanel hidden"></div>
  <div id="toast" class="toast"></div>
`;hud.appendChild(overlay);
const weaponTag=$('weaponTag'), shopPanel=$('shopPanel'), toast=$('toast');

function toastMsg(t){toast.textContent=t;toast.classList.add('show');clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>toast.classList.remove('show'),1100)}
function popup(text,world,color='#fff'){const d=document.createElement('div');d.className='scorePop';d.textContent=text;d.style.color=color;hud.appendChild(d);const v=world.clone().project(camera);d.style.left=((v.x*.5+.5)*innerWidth)+'px';d.style.top=((-v.y*.5+.5)*innerHeight)+'px';setTimeout(()=>d.remove(),520)}

function audio(type){try{const AC=window.AudioContext||window.webkitAudioContext;if(!audio.c)audio.c=new AC();const c=audio.c;c.resume();const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.connect(f);f.connect(g);g.connect(c.destination);const t=c.currentTime;if(type==='head'){o.type='square';o.frequency.setValueAtTime(800,t);o.frequency.exponentialRampToValueAtTime(170,t+.14);f.type='bandpass';f.frequency.value=1000;g.gain.setValueAtTime(.1,t);g.gain.exponentialRampToValueAtTime(.001,t+.16)}else if(type==='reload'){o.type='triangle';o.frequency.setValueAtTime(170,t);o.frequency.exponentialRampToValueAtTime(90,t+.12);f.type='bandpass';f.frequency.value=620;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+.18)}else{o.type='sawtooth';o.frequency.setValueAtTime(state.weapon.key==='shotgun'?78:105,t);o.frequency.exponentialRampToValueAtTime(38,t+.1);f.type='lowpass';f.frequency.value=state.weapon.key==='shotgun'?800:1200;g.gain.setValueAtTime(state.weapon.key==='shotgun'?.25:.18,t);g.gain.exponentialRampToValueAtTime(.001,t+.13)}o.start(t);o.stop(t+.2)}catch{}}
const vibrate=x=>navigator.vibrate&&navigator.vibrate(x);
function bloodBurst(p,head=false){for(let i=0;i<(head?12:7);i++){const m=new THREE.Mesh(new THREE.SphereGeometry(head?.046:.035,6,6),new THREE.MeshBasicMaterial({color:head?0xffd65a:0xb81713}));m.position.copy(p);scene.add(m);particles.push({m,v:new THREE.Vector3((Math.random()-.5)*3.2,Math.random()*2.5+.4,(Math.random()-.5)*3.2),life:.3+Math.random()*.2})}}

function healthBar(){const g=new THREE.Group();const bg=new THREE.Mesh(new THREE.PlaneGeometry(.85,.07),new THREE.MeshBasicMaterial({color:0x140909,depthTest:false}));const fill=new THREE.Mesh(new THREE.PlaneGeometry(.8,.045),new THREE.MeshBasicMaterial({color:0xff3b2f,depthTest:false}));fill.position.z=.001;g.add(bg,fill);g.position.y=2.65;g.userData.fill=fill;return g}
function makeZombie(type){const isBoss=type==='boss',isBrute=type==='brute',isToxic=type==='toxic';const pal=isToxic?{s:0x63834e,c1:0x263d31,c2:0x425b24,e:0x77ff55}:{s:[0x7d8966,0x6e785e,0x87916f][Math.floor(Math.random()*3)],c1:[0x3e4c5c,0x51403f,0x303a47][Math.floor(Math.random()*3)],c2:[0x6b2d27,0x274b65,0x5d3328][Math.floor(Math.random()*3)],e:isBoss?0xff3311:0xffb83f};const root=new THREE.Group(),parts={};const skin=new THREE.MeshStandardMaterial({color:pal.s,roughness:.92,emissive:isToxic?0x113a0a:isBoss?0x360006:0x071006,emissiveIntensity:isBoss?.7:isToxic?.6:.18}),cloth=new THREE.MeshStandardMaterial({color:pal.c1,roughness:.9}),torn=new THREE.MeshStandardMaterial({color:pal.c2,roughness:.96}),eye=new THREE.MeshStandardMaterial({color:0xffffff,emissive:pal.e,emissiveIntensity:isBoss?9:6,toneMapped:false});
const add=(geo,mat,x,y,z,name,rx=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.x=rx;m.rotation.z=rz;m.castShadow=true;root.add(m);if(name)parts[name]=m;return m};
const sh=isBrute?.5:.39,hip=isBrute?.23:.16;add(new THREE.BoxGeometry(isBrute?.98:.72,isBrute?1.18:.95,isBrute?.5:.38),cloth,0,1.5,0,'torso');add(new THREE.BoxGeometry(isBrute?.72:.52,.38,.28),torn,0,.95,0,'pelvis');add(new THREE.SphereGeometry(isBoss?.35:isBrute?.31:.27,14,14),skin,0,2.18,0,'head');add(new THREE.BoxGeometry(.22,.12,.16),new THREE.MeshStandardMaterial({color:0x41362e,roughness:.96}),0,2.01,.12,'jaw');
parts.eyeL=add(new THREE.SphereGeometry(.045,8,8),eye,-.09,2.2,.21,'eyeL');parts.eyeR=add(new THREE.SphereGeometry(.045,8,8),eye,.09,2.2,.21,'eyeR');
parts.upperL=add(new THREE.BoxGeometry(isBrute?.18:.14,.72,.16),skin,-sh,1.62,0,'upperL',.15,.2);parts.upperR=add(new THREE.BoxGeometry(isBrute?.18:.14,.72,.16),skin,sh,1.62,0,'upperR',.15,-.2);parts.foreL=add(new THREE.BoxGeometry(isBrute?.16:.12,.62,.14),skin,-sh,1.08,.04,'foreL',.3,.12);parts.foreR=add(new THREE.BoxGeometry(isBrute?.16:.12,.62,.14),skin,sh,1.08,.04,'foreR',.3,-.12);parts.legL=add(new THREE.BoxGeometry(isBrute?.21:.15,.82,.18),torn,-hip,.41,0,'legL',0,.06);parts.legR=add(new THREE.BoxGeometry(isBrute?.21:.15,.82,.18),torn,hip,.41,0,'legR',0,-.06);add(new THREE.BoxGeometry(.24,.18,.18),torn,-sh,1.85,.03,null,0,.4);add(new THREE.BoxGeometry(.22,.16,.16),torn,sh,1.82,.03,null,0,-.35);
if(isBoss){add(new THREE.ConeGeometry(.12,.38,5),new THREE.MeshStandardMaterial({color:0x5f1318,emissive:0x330006,emissiveIntensity:1.8}),0,2.62,0);root.scale.setScalar(1.18)}else if(isBrute)root.scale.setScalar(1.1);const bar=healthBar();root.add(bar);parts.bar=bar;return{root,parts}}

function collides(p,r=.4){return walls.some(w=>Math.abs(p.x-w.m.position.x)<w.w/2+r&&Math.abs(p.z-w.m.position.z)<w.d/2+r)}
function spawnZombie(type='normal'){const v=makeZombie(type);let p,tries=0;do{const a=Math.random()*Math.PI*2,r=17+Math.random()*7;p=new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r);tries++}while(collides(p,.8)&&tries<12);v.root.position.copy(p);scene.add(v.root);const base=type==='boss'?520:type==='brute'?190:type==='toxic'?120:90;const hp=base*(1+(state.wave-1)*.12);state.zombies.push({root:v.root,parts:v.parts,type,hp,maxHp:hp,speed:(type==='boss'?1.2:type==='brute'?1.08:type==='toxic'?1.85:1.7)*(1+Math.min(.48,state.wave*.025)),attack:0,dead:false,stagger:0,phase:Math.random()*10});state.alive++;updateHud()}

function startWave(){state.between=false;state.waveStarted=true;$('upgradePanel').classList.add('hidden');shopPanel.classList.add('hidden');const b=$('roundBanner');b.querySelector('strong').textContent=state.wave;b.classList.remove('show');void b.offsetWidth;b.classList.add('show');const n=Math.min(7+state.wave*2,40);for(let i=0;i<n;i++)setTimeout(()=>{if(!state.running)return;let t='normal';const r=Math.random();if(state.wave%5===0&&i===n-1)t='boss';else if(r<.10)t='brute';else if(r<.22)t='toxic';spawnZombie(t)},i*210)}
function nextWave(){state.between=true;setTimeout(()=>{state.wave++;state.points+=250;toastMsg('WAVE CLEAR +250');startWave()},1200)}

function showHit(head){const h=$('hitmarker');h.classList.toggle('head',head);h.classList.add('show');cross.classList.add(head?'head':'hit');clearTimeout(showHit.t);showHit.t=setTimeout(()=>{h.classList.remove('show');cross.classList.remove('hit','head')},90);if(head){const hs=$('headshot');hs.classList.remove('show');void hs.offsetWidth;hs.classList.add('show')}}
function killZombie(z,head,p){if(z.dead)return;z.dead=true;state.kills++;state.alive--;state.combo++;state.comboUntil=performance.now()+1800;const gain=(head?180:100)*Math.max(1,state.combo),pts=head?120:70;state.score+=gain;state.points+=pts;popup('+'+pts,p,head?'#ffd65a':'#fff');z.root.rotation.x=head?-.35:.18;if(head){audio('head');vibrate([15,18,35])}if(Math.random()<.07){state.hp=Math.min(state.maxHp,state.hp+20);toastMsg('HEALTH +20')}if(Math.random()<.06){state.weapon.reserveAmmo+=Math.ceil(state.weapon.reserve*.16);toastMsg('AMMO DROP')}setTimeout(()=>{scene.remove(z.root);state.zombies=state.zombies.filter(q=>q!==z);if(state.alive<=0&&!state.between)nextWave()},220);updateHud()}

function firePellet(offsetX=0,offsetY=0){raycaster.setFromCamera(new THREE.Vector2(offsetX,offsetY),camera);const hits=raycaster.intersectObjects(state.zombies.filter(z=>!z.dead).map(z=>z.root),true);if(!hits.length)return;const hit=hits[0],z=state.zombies.find(q=>q.root===hit.object||q.root.children.includes(hit.object));if(!z)return;const local=z.root.worldToLocal(hit.point.clone());const head=local.y>1.82||hit.object===z.parts.head||hit.object===z.parts.eyeL||hit.object===z.parts.eyeR;const dmg=state.weapon.damage*state.damageMult*(head?state.headMult:1);z.hp-=dmg;z.stagger=head?.2:.11;z.parts.bar.userData.fill.scale.x=Math.max(.001,z.hp/z.maxHp);z.parts.bar.userData.fill.position.x=-(.8*(1-z.hp/z.maxHp))/2;bloodBurst(hit.point,head);showHit(head);popup(head?'CRIT':'-'+Math.round(dmg),hit.point,head?'#ffd65a':'#ffb1aa');if(z.hp<=0)killZombie(z,head,hit.point)}
function shoot(){const now=performance.now(),w=state.weapon;if(!state.running||state.paused||state.reloading||state.between||now-state.lastShot<w.fireRate)return;if(w.ammo<=0){reload();return}state.lastShot=now;w.ammo--;audio('shot');vibrate(w.key==='shotgun'?18:9);muzzleLight.intensity=w.key==='shotgun'?190:145;setTimeout(()=>muzzleLight.intensity=0,35);gun.userData.kick=w.recoil;state.pitch=Math.min(.92,state.pitch+w.recoil*.08);cross.classList.add('fire');setTimeout(()=>cross.classList.remove('fire'),70);for(let i=0;i<w.pellets;i++)firePellet((Math.random()-.5)*w.spread,(Math.random()-.5)*w.spread);updateHud()}
function reload(){const w=state.weapon;if(state.reloading||w.ammo===w.mag||w.reserveAmmo<=0)return;state.reloading=true;audio('reload');setTimeout(()=>{const n=Math.min(w.mag-w.ammo,w.reserveAmmo);w.ammo+=n;w.reserveAmmo-=n;state.reloading=false;updateHud()},w.reload*state.reloadMult)}
function damagePlayer(n){if(!state.running)return;state.hp-=n;$('damageFlash').style.opacity=.9;setTimeout(()=>$('damageFlash').style.opacity=0,100);vibrate(25);if(state.hp<=0){state.hp=0;state.running=false;resetJoy();startScreen.classList.remove('hidden');hud.classList.add('hidden');startScreen.querySelector('p').innerHTML=`Partie terminée — Score <b>${Math.floor(state.score)}</b><br>Vague <b>${state.wave}</b> · Kills <b>${state.kills}</b>`;$('startBtn').textContent='REJOUER'}updateHud()}

function equip(k){if(!state.owned.includes(k))state.owned.push(k);state.weaponKey=k;state.weapon=cloneWeapon(k);toastMsg('EQUIPPED: '+state.weapon.name);updateHud()}
function mystery(){if(state.points<950){toastMsg('950 POINTS REQUIRED');return}state.points-=950;const keys=Object.keys(W).filter(k=>k!==state.weaponKey),k=keys[Math.floor(Math.random()*keys.length)];equip(k)}
function switchWeapon(){if(state.owned.length<2){toastMsg('FIND A SECOND WEAPON');return}const i=state.owned.indexOf(state.weaponKey);equip(state.owned[(i+1)%state.owned.length])}
function openPerks(){shopPanel.innerHTML='';const list=[['IRON HEART','+50 MAX HP',1400,'iron',()=>{state.maxHp+=50;state.hp=state.maxHp}],['QUICK HANDS','RELOAD -25%',1200,'quick',()=>state.reloadMult=.75],['DEADEYE','HEADSHOT +35%',1600,'deadeye',()=>state.headMult*=1.35],['RUSH','MOVE +15%',1100,'rush',()=>state.moveSpeed*=1.15]];for(const [n,d,c,k,fn] of list){const b=document.createElement('button');b.className='perkCard';b.disabled=state.perks[k];b.innerHTML=`<b>${state.perks[k]?'OWNED':n}</b><span>${d}</span><em>${state.perks[k]?'✓':c+' PTS'}</em>`;b.onclick=()=>{if(state.perks[k])return;if(state.points<c){toastMsg('NOT ENOUGH POINTS');return}state.points-=c;state.perks[k]=true;fn();openPerks();updateHud()};shopPanel.appendChild(b)}shopPanel.classList.toggle('hidden')}
$('boxBtn').onclick=mystery;$('perkBtn').onclick=openPerks;$('switchBtn').onclick=switchWeapon;

function updateHud(){$('wave').textContent=state.wave;$('score').textContent=Math.floor(state.score)+' · '+state.points+'P';$('remaining').textContent=state.alive;$('ammo').textContent=state.weapon.ammo;$('reserve').textContent=state.weapon.reserveAmmo;$('healthText').textContent=Math.ceil(state.hp);$('healthFill').style.width=`${Math.max(0,state.hp/state.maxHp*100)}%`;weaponTag.textContent=state.weapon.name+' · '+state.weapon.damage+' DMG';$('combo').textContent=state.combo>=2?`×${state.combo} COMBO`:''}

function placeJoy(x,y){const r=66,cx=THREE.MathUtils.clamp(x,r+10,innerWidth*.45-r),cy=THREE.MathUtils.clamp(y,innerHeight*.32+r,innerHeight-r-10);joyCenter={x:cx,y:cy};joy.style.left=`${cx-r}px`;joy.style.top=`${cy-r}px`;joy.style.bottom='auto';joy.classList.add('active')}
function moveJoy(x,y){const m=43,dx0=x-joyCenter.x,dy0=y-joyCenter.y,l=Math.hypot(dx0,dy0)||1,s=Math.min(1,m/l),dx=dx0*s,dy=dy0*s;stick.style.transform=`translate(${dx}px,${dy}px)`;const nx=dx/m,ny=dy/m,d=.06;input.tx=Math.abs(nx)<d?0:nx;input.ty=Math.abs(ny)<d?0:ny}
function resetJoy(){input.joyId=null;input.tx=input.ty=0;stick.style.transform='translate(0px,0px)';joy.classList.remove('active')}
function moveArea(x,y,t){return state.running&&!state.between&&x<innerWidth*.48&&y>innerHeight*.20&&!t.closest?.('button,.shopPanel,.upgradePanel')}
document.addEventListener('pointerdown',e=>{if(moveArea(e.clientX,e.clientY,e.target)){input.joyId=e.pointerId;placeJoy(e.clientX,e.clientY);moveJoy(e.clientX,e.clientY);if(e.cancelable)e.preventDefault()}},{capture:true});
document.addEventListener('pointermove',e=>{if(e.pointerId===input.joyId)moveJoy(e.clientX,e.clientY)},{capture:true});document.addEventListener('pointerup',e=>{if(e.pointerId===input.joyId)resetJoy()},{capture:true});document.addEventListener('pointercancel',e=>{if(e.pointerId===input.joyId)resetJoy()},{capture:true});
lookZone.addEventListener('pointerdown',e=>{if(input.lookId==null){input.lookId=e.pointerId;lx=e.clientX;ly=e.clientY;try{lookZone.setPointerCapture(e.pointerId)}catch{}}});lookZone.addEventListener('pointermove',e=>{if(e.pointerId!==input.lookId)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;state.yaw-=dx*.00455;state.pitch=THREE.MathUtils.clamp(state.pitch-dy*.0039,-1.05,1.05)});lookZone.addEventListener('pointerup',e=>{if(e.pointerId===input.lookId)input.lookId=null});lookZone.addEventListener('pointercancel',e=>{if(e.pointerId===input.lookId)input.lookId=null});
fireBtn.addEventListener('pointerdown',e=>{input.fire=true;shoot();try{fireBtn.setPointerCapture(e.pointerId)}catch{}if(e.cancelable)e.preventDefault()});fireBtn.addEventListener('pointerup',()=>input.fire=false);fireBtn.addEventListener('pointercancel',()=>input.fire=false);reloadBtn.onclick=reload;

function stepPlayer(dt){camera.rotation.order='YXZ';camera.rotation.y=state.yaw;camera.rotation.x=state.pitch;input.jx=THREE.MathUtils.lerp(input.jx,input.tx,Math.min(1,dt*15));input.jy=THREE.MathUtils.lerp(input.jy,input.ty,Math.min(1,dt*15));const mag=Math.min(1,Math.hypot(input.jx,input.jy)),f=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw)),r=new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw)),mv=f.multiplyScalar(-input.jy).add(r.multiplyScalar(input.jx));if(mv.lengthSq()>1)mv.normalize();const sprint=mag>.82?1.38:1,d=mv.multiplyScalar(state.moveSpeed*sprint*dt),px=camera.position.clone();px.x+=d.x;px.y=1.7;if(!collides(px))camera.position.x=px.x;const pz=camera.position.clone();pz.z+=d.z;pz.y=1.7;if(!collides(pz))camera.position.z=pz.z;state.targetFov=sprint>1?79:72;state.fov=THREE.MathUtils.lerp(state.fov,state.targetFov,Math.min(1,dt*7));if(Math.abs(camera.fov-state.fov)>.03){camera.fov=state.fov;camera.updateProjectionMatrix()}const t=performance.now()*.0075,b=mag>.04?1:0;gun.position.x=.36+Math.sin(t)*.018*mag*b;gun.position.y=-.34-Math.abs(Math.cos(t))*.017*mag*b;camera.position.y=1.7+(b?Math.sin(t*2)*.009*mag:0);const k=gun.userData.kick||0;gun.position.z=-.72+k;gun.rotation.x=-k*2;gun.userData.kick=THREE.MathUtils.lerp(k,0,Math.min(1,dt*22));gun.rotation.z=state.reloading?Math.sin(performance.now()/(state.weapon.reload*state.reloadMult)*Math.PI)*-.8:THREE.MathUtils.lerp(gun.rotation.z,0,dt*9)}
function animZombie(z,t){const a=Math.sin(t*6+z.phase),b=Math.sin(t*6+z.phase+Math.PI);z.parts.upperL.rotation.x=.35+a*.45;z.parts.upperR.rotation.x=.35+b*.45;z.parts.foreL.rotation.x=.18+a*.28;z.parts.foreR.rotation.x=.18+b*.28;z.parts.legL.rotation.x=b*.58;z.parts.legR.rotation.x=a*.58;z.parts.head.rotation.y=Math.sin(t*2+z.phase)*.15;z.parts.bar.quaternion.copy(camera.quaternion)}
function stepZombies(dt){const t=performance.now()*.001;for(let i=0;i<state.zombies.length;i++){const z=state.zombies[i];if(z.dead)continue;const p=z.root.position,target=camera.position.clone();target.y=0;const dist=p.distanceTo(target),dir=target.sub(p).normalize();if(z.stagger>0){z.stagger-=dt;z.root.position.addScaledVector(dir,-dt*.55);continue}for(let j=0;j<state.zombies.length;j++){if(i===j)continue;const o=state.zombies[j];if(o.dead)continue;const dd=p.distanceTo(o.root.position);if(dd>0&&dd<.95)dir.addScaledVector(p.clone().sub(o.root.position).normalize(),(.95-dd)*.55)}dir.normalize();if(dist>1.15){let next=p.clone().addScaledVector(dir,z.speed*dt);if(!collides(next,.45))p.copy(next);else{const alt=dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),.9);next=p.clone().addScaledVector(alt,z.speed*.65*dt);if(!collides(next,.45))p.copy(next)}z.root.lookAt(camera.position.x,1.2,camera.position.z);z.root.position.y=Math.abs(Math.sin(t*6+z.phase))*.032;animZombie(z,t)}else{z.attack-=dt;z.parts.upperL.rotation.x=.95;z.parts.upperR.rotation.x=.95;if(z.attack<=0){z.attack=.72+Math.random()*.25;damagePlayer(z.type==='boss'?26:z.type==='brute'?18:z.type==='toxic'?14:11)}}}}
function stepParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=6*dt;p.m.position.addScaledVector(p.v,dt);p.m.scale.multiplyScalar(.985);if(p.life<=0){scene.remove(p.m);particles.splice(i,1)}}}
function loop(){requestAnimationFrame(loop);const dt=Math.min(.033,clock.getDelta());if(state.running&&!state.paused){if(input.fire)shoot();if(!state.between){stepPlayer(dt);stepZombies(dt)}stepParticles(dt);if(state.combo&&performance.now()>state.comboUntil)state.combo=0;updateHud()}renderer.render(scene,camera)}loop();

function reset(){state.zombies.forEach(z=>scene.remove(z.root));particles.forEach(p=>scene.remove(p.m));particles.length=0;Object.assign(state,{running:true,paused:false,between:false,wave:1,score:0,points:500,hp:100,maxHp:100,zombies:[],alive:0,kills:0,yaw:0,pitch:0,moveSpeed:5.8,fov:72,targetFov:72,combo:0,comboUntil:0,lastShot:0,reloading:false,headMult:2.5,damageMult:1,reloadMult:1,weaponKey:'rifle',owned:['rifle'],perks:{iron:false,quick:false,deadeye:false,rush:false}});state.weapon=cloneWeapon('rifle');input.jx=input.jy=input.tx=input.ty=0;input.fire=false;resetJoy();camera.position.set(0,1.7,8);camera.fov=72;camera.updateProjectionMatrix();shopPanel.classList.add('hidden');updateHud();startWave()}
$('startBtn').onclick=async()=>{try{await document.documentElement.requestFullscreen?.()}catch{}startScreen.classList.add('hidden');hud.classList.remove('hidden');reset()};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.45));resetJoy()});document.addEventListener('visibilitychange',()=>{state.paused=document.hidden;if(document.hidden)resetJoy()});
