// ===== 3D ワールド（仕上げ）：カメラ・操作・描画ループ =====
const Cam={az:.6,el:.95,dist:130,tgt:new V3(),userAz:.6,userEl:.95,userDist:24,rouletteView:false,introUntil:0,followObj:null,followDist:null,is2D:false,H:80,zoom2:1,pan:new V3(),title:true,focus:null};
let last=performance.now(),tAcc=0,skyCol=new THREE.Color(SKY[0]);

function initWorld(){
  const el=$('#stage');
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(innerWidth,innerHeight);el.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(SKY[0]);scene.fog=new THREE.Fog(SKY[0],170,480);
  camP=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.5,900);
  camO=new THREE.OrthographicCamera(-1,1,1,-1,1,800);
  hemi=new THREE.HemisphereLight(0xffffff,0x88aa77,.5);scene.add(hemi);
  sun=new THREE.DirectionalLight(0xffffff,.5);sun.position.set(60,120,40);scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff,.18));
  buildPath();buildTiles();buildScenery();buildCenter();scene.add(worldG);
  worldG.updateMatrixWorld(true);occ.forEach(o=>{o.box=new THREE.Box3().setFromObject(o.g).expandByScalar(.5);o.hid=false});
  fitOrtho();
  addEventListener('resize',onResize);
  bindInput(renderer.domElement);
  setInterval(update,16);
  const loop=()=>{renderer.render(scene,Cam.is2D?camO:camP);requestAnimationFrame(loop)};loop();
}
function aspect(){return innerWidth/Math.max(1,innerHeight)}
function fitOrtho(){
  const a=aspect(),H=Cam.H/Cam.zoom2;
  camO.left=-H*a;camO.right=H*a;camO.top=H;camO.bottom=-H;camO.updateProjectionMatrix();
}
function fitH(){return Math.max(64,118/aspect())}
function onResize(){
  renderer.setSize(innerWidth,innerHeight);camP.aspect=aspect();camP.updateProjectionMatrix();Cam.H=fitH();fitOrtho();
}
Cam.set2D=on=>{Cam.is2D=on;Cam.H=fitH();Cam.zoom2=1;Cam.pan.set(0,0,0);fitOrtho()};

/* ---------- 操作：ドラッグ回転・ホイール／ピンチでズーム（タッチ対応） ---------- */
function bindInput(c){
  const ptrs=new Map();let pinch=0;
  c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y)}Sound.resume()});
  c.addEventListener('pointermove',e=>{
    const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(ptrs.size===2){
      const[a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)zoomBy(pinch/d);pinch=d;
    }else if(ptrs.size===1){
      if(Cam.is2D){const s=2*(Cam.H/Cam.zoom2)/innerHeight;Cam.pan.x-=dx*s;Cam.pan.z-=dy*s}
      else{Cam.userAz-=dx*.006;Cam.userEl=clamp(Cam.userEl+dy*.005,.2,1.45)}
    }
  });
  const up=e=>{ptrs.delete(e.pointerId);pinch=0};
  c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
  c.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(e.deltaY*.0012))},{passive:false});
}
function zoomBy(f){
  if(Cam.is2D){Cam.zoom2=clamp(Cam.zoom2/f,.5,5);fitOrtho()}
  else Cam.userDist=clamp(Cam.userDist*f,8,95);
}

/* ---------- 毎フレーム更新（setIntervalで駆動） ---------- */
const angDiff=(a,b)=>((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
function update(){
  const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;tAcc+=dt;
  updateTweens();
  const cur=G.players[G.cur];
  for(const id in cars){
    const c=cars[id];
    if(!c.anim){c.g.position.lerp(c.target,1-Math.exp(-dt*7));c.g.rotation.y+=angDiff(c.g.rotation.y,c.heading)*(1-Math.exp(-dt*6))}
    c.ring.visible=!c.p.finished&&cur===c.p&&!Cam.title;c.ring.scale.setScalar(1+Math.sin(tAcc*5)*.06);
    const s=(c.baseScale||1)*(Cam.is2D?1.9:1);c.g.scale.setScalar(s);
    c.seatG.children.forEach(d=>{if(!tweens.length)d.position.y=Math.abs(Math.sin(tAcc*2+(d.userData.ph||0)))*.015});
  }
  sway.forEach(g=>{g.rotation.z=Math.sin(tAcc*1.2+g.userData.ph)*.03});
  clouds.forEach(c=>{c.visible=!Cam.is2D;c.position.x+=c.userData.sp*dt;if(c.position.x>190)c.position.x=-190});
  if(bankCoin)bankCoin.rotation.z+=dt*1.5;
  updateRoulette(dt);updatePolice(dt);updateThugs(dt);
  if(bankDoor)bankDoor.position.y=performance.now()<bankOpenT?4.4:1.9;
  for(const id in TILE){const f=TILE[id];if(f.sq.c==='gold'){const fl=f.g.children.find(o=>o.userData.flag);if(fl)fl.rotation.y=Math.sin(tAcc*3)*.3}}
  for(let i=confetti.length-1;i>=0;i--){
    const f=confetti[i];f.life+=dt;f.v.y-=12*dt;f.m.position.addScaledVector(f.v,dt);f.m.rotation.x+=f.rs.x*dt;f.m.rotation.y+=f.rs.y*dt;
    if(f.life>1.8||f.m.position.y<0){scene.remove(f.m);confetti.splice(i,1)}
  }
  updateCamera(dt,cur);
  updateOcclusion();
}
let sTgt=new V3(),sAz=.6,sEl=.95,sDist=130;
function updateCamera(dt,cur){
  const k=1-Math.exp(-dt*(Cam.title?2:Cam.followObj?9:4.5));
  let tgt,az,el,dist;
  if(Cam.title){Cam.userAz+=dt*.1;tgt=new V3(0,0,0);az=Cam.userAz;el=.7;dist=135}
  else if(Cam.is2D){
    camO.position.set(Cam.pan.x,300,Cam.pan.z);camO.up.set(0,0,-1);camO.lookAt(Cam.pan.x,0,Cam.pan.z);return;
  }else if(Cam.rouletteView){tgt=new V3(0,6.2,1.0);az=0;el=1.42;dist=Math.max(15.5,14/aspect())}   // 真上から見て、針と止まる目がはっきり見える
  else{
    const c=cur&&cars[cur.id];tgt=Cam.followObj?Cam.followObj.position.clone():(c?c.g.position.clone():new V3());
    az=Cam.userAz;el=Cam.userEl;dist=Cam.userDist;
    if(Cam.followObj)dist=Cam.followDist||Math.max(dist,17);          // 走る車を追うときは少し引く／動き出す前はぐっと寄る
    if(performance.now()<Cam.introUntil){dist=Math.min(dist,9.5);el=.72}      // ターン開始：その人にぐっとズーム
  }
  sTgt.lerp(tgt,k);sAz+=angDiff(sAz,az)*k;sEl+=(el-sEl)*k;sDist+=(dist-sDist)*k;
  camP.position.set(sTgt.x+Math.sin(sAz)*Math.cos(sEl)*sDist,sTgt.y+Math.sin(sEl)*sDist,sTgt.z+Math.cos(sAz)*Math.cos(sEl)*sDist);
  camP.lookAt(sTgt);
  // 章ごとの空と光
  const ch=cur&&!Cam.title?chapterOf(cur.pos):0;
  skyCol.lerp(new THREE.Color(SKY[ch]),dt*1.2);scene.background.copy(skyCol);scene.fog.color.copy(skyCol);
  sun.color.lerp(new THREE.Color(ch===5?0xffb27a:ch===4?0xffe2b8:0xffffff),dt*1.2);
}
V.focus=p=>{Cam.focus=p};
V.setCamDefault=()=>{Cam.title=false;Cam.userDist=24;Cam.userEl=.95;sDist=130};

/* ---------- 山・ビル・木などが手前にあって見えないときは、その物体だけ非表示にして貫通して見せる ---------- */
const occRay=new THREE.Ray(),occHit=new V3(),occDir=new V3();
function updateOcclusion(){
  const on=!Cam.title&&!Cam.is2D&&G.players.length>0;
  const from=camP.position,to=sTgt;
  occDir.subVectors(to,from);const len=occDir.length();occDir.normalize();occRay.set(from,occDir);
  for(const o of occ){
    if(!o.box)continue;
    let hit=false;
    if(on&&occRay.intersectBox(o.box,occHit)){hit=from.distanceTo(occHit)<len-.8}
    if(hit!==o.hid){o.hid=hit;o.g.visible=!hit}
  }
}
