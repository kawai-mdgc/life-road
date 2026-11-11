// ===== 3D ワールド（後半）：背景・ルーレット・銀行・車・人形・お札・カメラ =====
const BANK_POS=new V3(-32,0,0),ROUL_POS=new V3(0,0,0);
const RAINBOW=[0xff3b3b,0xff8a1f,0xffd21f,0xa6e22e,0x2fd36f,0x1fd0d6,0x2f8cff,0x5b5bff,0x9b4dff,0xff4fb0];
const Roul={free:false,speed:0,max:8,last:-1};
const occ=[];
const sway=[],clouds=[],placed=[],cars={},houseSlots=[];
const chSquares=[[],[],[],[],[],[]],allPts=[];
let roulDisc=null,bankDoor=null,bankCoin=null,bubbleSpr=null,confetti=[];

/* ---------- 背景パーツ ---------- */
function winTex(col){
  return G_('win'+col,()=>canvasTex(64,128,(ctx,w,h)=>{
    ctx.fillStyle=hex(col);ctx.fillRect(0,0,w,h);
    for(let y=6;y<h-6;y+=20)for(let x=6;x<w-6;x+=18){ctx.fillStyle=(x*y)%3?'#cfeaff':'#ffe9a0';ctx.fillRect(x,y,10,12)}
  }));
}
function tree(x,z,kind,s=1){
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);
  mesh(G_('trunk',()=>new THREE.CylinderGeometry(.18,.26,1.5,7)),mat(0x8a5a35,30),0,.75,0,g);
  const sph=(r,y,c,dx=0,dz=0)=>mesh(G_('sp'+r,()=>new THREE.SphereGeometry(r,10,8)),mat(c,70),dx,y,dz,g);
  const cone=(r,h,y,c)=>mesh(G_('co'+r+h,()=>new THREE.ConeGeometry(r,h,8)),mat(c,50),0,y,0,g);
  if(kind==='pine'){cone(1.3,1.6,1.9,0x2f8f5b);cone(1.0,1.4,2.7,0x37a468);cone(.7,1.2,3.4,0x43b878)}
  else if(kind==='sakura'){sph(1.2,2.2,0xffb7d1);sph(.9,2.9,0xffc9de,.5,.3);sph(.8,2.5,0xffa9c8,-.6,-.3)}
  else if(kind==='autumn'){const cs=[0xff8a2b,0xe8452b,0xffc233,0xd96a1f];sph(1.2,2.2,cs[rnd(4)]);sph(.9,2.8,cs[rnd(4)],.5,.3);sph(.8,2.4,cs[rnd(4)],-.6,-.3)}
  else if(kind==='palm'){
    g.remove(g.children[0]);
    const t=mesh(G_('ptr',()=>new THREE.CylinderGeometry(.14,.22,3.6,7)),mat(0xb98a55,20),0,1.8,0,g);t.rotation.z=.12;
    for(let i=0;i<6;i++){const l=mesh(G_('leaf',()=>{const lg=new THREE.ConeGeometry(.32,2,5);lg.translate(0,1,0);return lg}),mat(0x2fbf6a,50),0,3.7,0,g);l.rotation.z=1.35;l.rotation.y=i*Math.PI/3}
  }
  else{sph(1.2,2.3,0x59c46a);sph(.9,3.0,0x6ed17f,.4,.2)}
  g.userData.ph=Math.random()*6;sway.push(g);worldG.add(g);occ.push({g});return g;
}
function houseSmall(x,z,wall,roof,s=1,rot=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;g.scale.setScalar(s);
  mesh(G_('hw',()=>new THREE.BoxGeometry(3,2,2.6)),mat(wall,60),0,1,0,g);
  const r=mesh(G_('hr',()=>new THREE.ConeGeometry(2.6,1.5,4)),mat(roof,70),0,2.7,0,g);r.rotation.y=Math.PI/4;
  mesh(G_('hd',()=>new THREE.BoxGeometry(.6,1.1,.1)),mat(0x7a4a2a),0,.55,1.32,g);
  mesh(G_('hwi',()=>new THREE.BoxGeometry(.6,.6,.1)),mat(0xbfe6ff,100),-.9,1.2,1.32,g);
  mesh(G_('hwi',()=>new THREE.BoxGeometry(.6,.6,.1)),mat(0xbfe6ff,100),.9,1.2,1.32,g);
  worldG.add(g);occ.push({g});return g;
}
function building(x,z,w,h,d,col){
  const m=new THREE.MeshPhongMaterial({color:0xffffff,map:winTex(col).clone(),shininess:60,specular:0x555555});
  m.map=winTex(col).clone();m.map.wrapS=m.map.wrapT=THREE.RepeatWrapping;m.map.repeat.set(Math.max(1,w/3),Math.max(1,h/5));m.map.needsUpdate=true;
  const g=new THREE.Group();g.position.set(x,0,z);
  mesh(new THREE.BoxGeometry(w,h,d),m,0,h/2,0,g);
  mesh(new THREE.BoxGeometry(w+.3,.4,d+.3),mat(0xdfe6ef),0,h+.2,0,g);
  worldG.add(g);occ.push({g});return g;
}
function mountain(x,z,r,h){
  const g=new THREE.Group();g.position.set(x,0,z);
  mesh(new THREE.ConeGeometry(r,h,7),mat(0x7e9c86,20),0,h/2,0,g);
  mesh(new THREE.ConeGeometry(r*.38,h*.3,7),mat(0xffffff,40),0,h*.85,0,g);
  worldG.add(g);occ.push({g});return g;
}
function cloud(x,y,z,s){
  const g=new THREE.Group();g.position.set(x,y,z);
  [[0,0,0,3],[3,-.3,.5,2.4],[-3,-.2,-.4,2.4],[1.2,1,0,2.2]].forEach(a=>mesh(G_('cl'+a[3],()=>new THREE.SphereGeometry(a[3],10,8)),new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.95}),a[0],a[1],a[2],g));
  g.scale.setScalar(s);g.userData.sp=.4+Math.random()*.6;clouds.push(g);scene.add(g);
}
function school(x,z,rot){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;
  mesh(new THREE.BoxGeometry(9,3.4,3.6),mat(0xe8b99a,40),0,1.7,0,g);
  mesh(new THREE.BoxGeometry(9.4,.3,4),mat(0xc0504d),0,3.5,0,g);
  mesh(new THREE.BoxGeometry(2,5.6,2),mat(0xe8b99a,40),0,2.8,-.4,g);
  mesh(new THREE.ConeGeometry(1.6,1.4,4),mat(0xc0504d),0,6.3,-.4,g).rotation.y=Math.PI/4;
  const clock=mesh(new THREE.CircleGeometry(.6,20),new THREE.MeshBasicMaterial({color:0xffffff}),0,4.8,.62,g);
  for(let i=0;i<5;i++)mesh(new THREE.BoxGeometry(.8,.8,.1),mat(0xbfe6ff,100),-3.4+i*1.7,2,1.85,g);
  mesh(new THREE.BoxGeometry(1,1.6,.1),mat(0x7a4a2a),0,.8,1.85,g);
  mesh(new THREE.CylinderGeometry(.05,.05,4,6),mat(0xffffff),5,2,2.5,g);
  mesh(new THREE.PlaneGeometry(1.2,.7),new THREE.MeshBasicMaterial({color:0xff4d5a,side:THREE.DoubleSide}),5.6,3.7,2.5,g);
  worldG.add(g);occ.push({g});
}
function swings(x,z,rot){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;
  [-1.6,1.6].forEach(a=>{[-.8,.8].forEach(b=>{const l=mesh(new THREE.CylinderGeometry(.06,.06,2.8,6),mat(0xff6b9d),a,1.3,b,g);l.rotation.x=b>0?.2:-.2})});
  mesh(new THREE.CylinderGeometry(.07,.07,3.6,6),mat(0xff6b9d),0,2.6,0,g).rotation.z=Math.PI/2;
  [-.7,.7].forEach(a=>mesh(new THREE.BoxGeometry(.6,.08,.3),mat(0xffc933),a,.9,0,g));
  worldG.add(g);
}
function slide(x,z,rot){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;
  mesh(new THREE.BoxGeometry(1.2,2,1.2),mat(0x3f8cff),0,1,0,g);
  const r=mesh(new THREE.BoxGeometry(.9,.12,3),mat(0xffc933),0,1,2,g);r.rotation.x=-.6;r.position.set(0,1,1.8);
  worldG.add(g);
}
function flowerPatch(x,z){
  const cs=[0xff6b9d,0xffd23f,0xffffff,0xb98cff];
  for(let i=0;i<7;i++)mesh(G_('fl',()=>new THREE.SphereGeometry(.22,8,6)),mat(cs[rnd(4)],60),x+(Math.random()-.5)*2.4,.25,z+(Math.random()-.5)*2.4,worldG);
}
function sailboat(x,z,r){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=r;
  mesh(new THREE.BoxGeometry(3,.7,1.2),mat(0xffffff),0,.3,0,g);
  mesh(new THREE.CylinderGeometry(.05,.05,3.4,6),mat(0x888888),0,2,0,g);
  mesh(new THREE.ConeGeometry(1,3,3),mat(0xff6b9d),0,2.1,0,g).rotation.z=0;
  worldG.add(g);return g;
}
function lighthouse(x,z){
  const g=new THREE.Group();g.position.set(x,0,z);
  mesh(new THREE.CylinderGeometry(1,1.6,8,12),mat(0xffffff),0,4,0,g);
  [1.5,4,6.5].forEach(y=>mesh(new THREE.CylinderGeometry(1.05,1.05,.9,12),mat(0xff4d5a),0,y,0,g));
  mesh(new THREE.CylinderGeometry(1.2,1.2,1.2,12),mat(0xffe27a,40,{emissive:0x886600}),0,8.7,0,g);
  mesh(new THREE.ConeGeometry(1.4,1.2,12),mat(0xff4d5a),0,9.9,0,g);
  worldG.add(g);
}
function freeSpot(ch,minPath,r,rad0=5,rad1=22,tries=80){
  for(let t=0;t<tries;t++){
    const b=chSquares[ch][rnd(chSquares[ch].length)],a=Math.random()*Math.PI*2,d=rad0+Math.random()*(rad1-rad0);
    const x=b.x+Math.cos(a)*d,z=b.z+Math.sin(a)*d;
    if(Math.hypot(x,z)<14||Math.hypot(x-BANK_POS.x,z-BANK_POS.z)<10)continue;
    if(Math.abs(x)>150||Math.abs(z)>85)continue;
    if(allPts.some(q=>(q.x-x)**2+(q.z-z)**2<minPath*minPath))continue;
    if(placed.some(q=>(q.x-x)**2+(q.z-z)**2<(q.r+r)**2))continue;
    placed.push({x,z,r});return{x,z};
  }
  return null;
}
function scatter(ch,n,minPath,r,fn,rad0,rad1){for(let i=0;i<n;i++){const s=freeSpot(ch,minPath,r,rad0,rad1);if(s)fn(s.x,s.z,i)}}

function buildScenery(){
  SQDATA.forEach(s=>{const p=POS[s.id];chSquares[chapterOf(s.id)].push(p);allPts.push(p)});
  // 地面
  const gr=mesh(new THREE.PlaneGeometry(700,420),new THREE.MeshLambertMaterial({color:0xa7e08f}),0,-.08,0);gr.rotation.x=-Math.PI/2;worldG.add(gr);
  for(let c=0;c<6;c++){
    const pts=chSquares[c],cx=pts.reduce((a,p)=>a+p.x,0)/pts.length,cz=pts.reduce((a,p)=>a+p.z,0)/pts.length;
    const rad=Math.min(48,Math.max(...pts.map(p=>Math.hypot(p.x-cx,p.z-cz)))+16);
    const m=mesh(new THREE.CircleGeometry(rad,40),new THREE.MeshLambertMaterial({color:GROUND[c]}),cx,-.06+c*.004,cz,worldG);m.rotation.x=-Math.PI/2;
  }
  // 橋と川（第4章・マス95付近）
  {
    const p=POS[95],h=HEAD[95],g=new THREE.Group();g.position.copy(p);g.rotation.y=Math.atan2(-h.z,h.x);
    mesh(new THREE.BoxGeometry(9,.1,70),new THREE.MeshPhongMaterial({color:0x4aa3ff,shininess:100,transparent:true,opacity:.9}),0,-.02,0,g);
    mesh(new THREE.BoxGeometry(9.4,.34,3.9),mat(0xd9b38c,30),0,.0,0,g);
    [-1,1].forEach(s=>{mesh(new THREE.BoxGeometry(9.4,.5,.15),mat(0xffffff),0,.5,s*1.9,g);[-4,-2,0,2,4].forEach(x=>mesh(new THREE.BoxGeometry(.15,.8,.15),mat(0xffffff),x,.4,s*1.9,g))});
    [-3.5,3.5].forEach(x=>mesh(new THREE.CylinderGeometry(.45,.45,1.6,10),mat(0xb9a58c),x,-.6,0,g));
    worldG.add(g);
    const perp=new V3(-h.z,0,h.x);for(let i=-3;i<=3;i++)placed.push({x:p.x+perp.x*i*8,z:p.z+perp.z*i*8,r:6});
    placed.push({x:p.x,z:p.z,r:7});
  }
  // 第1章 春の公園と学校
  {const s=freeSpot(0,6,8,8,18);if(s)school(s.x,s.z,Math.PI*.1);
   const a=freeSpot(0,4,3,6,16);if(a)swings(a.x,a.z,.5);const b=freeSpot(0,4,3,6,16);if(b)slide(b.x,b.z,1);
   scatter(0,16,3.5,2.2,(x,z,i)=>tree(x,z,i%3?'sakura':'round',.8+Math.random()*.5),4,20);
   scatter(0,12,2.8,1.4,(x,z)=>flowerPatch(x,z),3,16)}
  // 第2章 ビル街
  {const cols=[0x7fb2e5,0x9ec5e8,0xb7a4e8,0x8fd6c4,0xf0b27a];
   scatter(1,14,5.5,5,(x,z,i)=>building(x,z,4+Math.random()*3,9+Math.random()*16,4+Math.random()*2,cols[i%5]),6,22);
   scatter(1,6,4,2.5,(x,z,i)=>houseSmall(x,z,0xffe0a8,0xe8554d,.9,Math.random()*3),4,14)}
  // 第3章 住宅地
  {const w=[0xfff0c8,0xffd6d6,0xd6f0ff,0xe6ffd6],r=[0xe8554d,0x3f8cff,0x7a4a2a,0x2fb36f];
   scatter(2,16,4,3.4,(x,z,i)=>houseSmall(x,z,w[i%4],r[(i*3)%4],1,Math.random()*6),5,20);
   scatter(2,10,3,1.8,(x,z)=>tree(x,z,'round',.8+Math.random()*.4),4,20)}
  // 第4章 山と橋
  {scatter(3,8,6,8,(x,z)=>mountain(x,z,5+Math.random()*5,8+Math.random()*9),10,34);
   scatter(3,16,3,1.8,(x,z)=>tree(x,z,'pine',.9+Math.random()*.6),4,22)}
  // 第5章 紅葉の町
  {scatter(4,18,3,2.2,(x,z)=>tree(x,z,'autumn',.9+Math.random()*.5),4,22);
   scatter(4,8,4.5,3.4,(x,z)=>houseSmall(x,z,0xd9b38c,0x5a3a2a,1.05,Math.random()*6),5,20)}
  // 第6章 夕焼けの海辺
  {const sea=mesh(new THREE.PlaneGeometry(420,90),new THREE.MeshPhongMaterial({color:0x2f9fe0,shininess:120,specular:0xffd9a8}),-30,-.04,96);sea.rotation.x=-Math.PI/2;worldG.add(sea);
   const sand=mesh(new THREE.PlaneGeometry(420,16),new THREE.MeshLambertMaterial({color:0xf1dba3}),-30,-.05,57);sand.rotation.x=-Math.PI/2;worldG.add(sand);
   const sun=mesh(new THREE.SphereGeometry(9,20,16),new THREE.MeshBasicMaterial({color:0xffb347}),-75,7,128,worldG);sun.userData.sun=1;
   scatter(5,10,3,1.8,(x,z)=>tree(x,z,'palm',1),4,18);
   [[-60,70],[-20,80],[-100,85]].forEach(a=>sailboat(a[0],a[1],Math.random()*3));
   lighthouse(-92,52);
   const p=POS[150],h=HEAD[150],g=new THREE.Group();g.position.copy(p);g.rotation.y=Math.atan2(-h.z,h.x);   // ゴールの門
   [-3.4,3.4].forEach(s=>mesh(new THREE.CylinderGeometry(.5,.6,6,12),mat(0xfff2c0),0,3,s,g));
   mesh(new THREE.BoxGeometry(1.2,.9,8.6),mat(0xf5b800),0,6.2,0,g);
   const bn=mesh(new THREE.PlaneGeometry(6,1.6),new THREE.MeshBasicMaterial({map:canvasTex(256,64,(c,w,hh)=>{c.fillStyle='#ff4f86';rr(c,0,0,w,hh,14);c.fill();c.fillStyle='#fff';c.font=`900 40px ${FONT}`;c.textAlign='center';c.textBaseline='middle';c.fillText('G O A L',w/2,hh/2+2)}),side:THREE.DoubleSide}),0,7.4,0,g);bn.rotation.y=Math.PI/2;
   worldG.add(g)}
  // 遠景の山と雲
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2,R=210+Math.random()*30;mountain(Math.cos(a)*R*1.25,Math.sin(a)*R*.7+10,16+Math.random()*14,22+Math.random()*20)}
  for(let i=0;i<16;i++)cloud((Math.random()-.5)*340,34+Math.random()*16,(Math.random()-.5)*200,.9+Math.random()*1.2);
}

/* ---------- 中央：ルーレット塔 と 銀行 ---------- */
function buildCenter(){
  const g=new THREE.Group();g.position.copy(ROUL_POS);
  mesh(new THREE.CylinderGeometry(7,7.6,.8,36),mat(0x3a2f6e,60),0,.4,0,g);   // 濃い色の台座：白いピンと盤が見やすい
  mesh(new THREE.CylinderGeometry(1.8,2.4,5,20),mat(0xffffff,90),0,3.2,0,g);
  [1.2,3,5].forEach(y=>mesh(new THREE.TorusGeometry(2.1-(y>4?.2:0),.14,8,24),mat(0xff4f86),0,y+.4,0,g).rotation.x=Math.PI/2);
  roulDisc=new THREE.Group();roulDisc.position.y=6.1;g.add(roulDisc);
  for(let i=0;i<10;i++){                                     // レインボーの10分割
    const th=i*Math.PI/5;
    mesh(new THREE.CylinderGeometry(4.4,4.4,.6,10,1,false,th,Math.PI/5),mat(RAINBOW[i],110),0,0,0,roulDisc);
    const c=th+Math.PI/10,sp=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTex(64,64,(ctx,w,h)=>{ctx.font=`900 48px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=9;ctx.strokeStyle='rgba(40,20,70,.85)';ctx.fillStyle='#fff';ctx.strokeText(i+1,32,34);ctx.fillText(i+1,32,34)}),transparent:true,depthTest:false}));
    sp.position.set(Math.sin(c)*3.1,.8,Math.cos(c)*3.1);sp.scale.set(1.5,1.5,1);sp.renderOrder=5;roulDisc.add(sp);
    // 区切り線（白）
    const ln=mesh(new THREE.BoxGeometry(4.4,.04,.07),mat(0xffffff,100),Math.sin(th)*2.2,.32,Math.cos(th)*2.2,roulDisc);ln.rotation.y=th-Math.PI/2;
  }
  mesh(new THREE.TorusGeometry(4.45,.2,8,40),mat(0xffffff,120),0,.3,0,roulDisc).rotation.x=Math.PI/2;
  mesh(new THREE.CylinderGeometry(.7,.7,.9,14),mat(0xffffff,120),0,.5,0,roulDisc);
  // 白いピン（針）：盤の外側から中心に向けて、止まった目を指す
  const ptr=mesh(new THREE.ConeGeometry(.6,1.7,18),mat(0xffffff,140,{emissive:0x444444}),0,6.85,5.15,g);ptr.rotation.x=-Math.PI/2;
  mesh(new THREE.SphereGeometry(.5,14,10),mat(0xffffff,140,{emissive:0x333333}),0,6.85,5.95,g);
  const pin=mesh(new THREE.BoxGeometry(.18,.05,2.4),mat(0xffffff,100,{emissive:0x555555}),0,6.52,3.3,g);pin.userData.pin=1;   // 針の先の目印ライン
  worldG.add(g);
  // 銀行
  const b=new THREE.Group();b.position.copy(BANK_POS);b.rotation.y=Math.PI/2;
  mesh(new THREE.BoxGeometry(9,.4,7),mat(0xe0e0e0),0,.2,0,b);
  mesh(new THREE.BoxGeometry(8,4.6,5.6),mat(0xffffff,70),0,2.7,-.2,b);
  for(let i=0;i<6;i++)mesh(new THREE.CylinderGeometry(.35,.35,4.6,12),mat(0xf6f6f6,100),-3.5+i*1.4,2.7,2.9,b);
  mesh(new THREE.BoxGeometry(9,.4,.9),mat(0xf6f6f6),0,5.2,2.9,b);
  const roof=mesh(new THREE.CylinderGeometry(4.6,4.6,9.4,3),mat(0xe8554d,70),0,6.1,-.2,b);roof.scale.set(.42,1,1);roof.rotation.set(0,0,Math.PI/2);
  bankDoor=mesh(new THREE.BoxGeometry(1.8,3,.2),mat(0x5a3a2a),0,1.9,2.55,b);
  bankCoin=mesh(new THREE.CylinderGeometry(1,1,.25,24),mat(0xffd23f,120),0,8.2,-.2,b);bankCoin.rotation.x=Math.PI/2;
  mesh(new THREE.PlaneGeometry(6,1.1),new THREE.MeshBasicMaterial({map:canvasTex(256,48,(c,w,h)=>{c.fillStyle='#2a63c8';rr(c,0,0,w,h,10);c.fill();c.fillStyle='#fff';c.font=`900 28px ${FONT}`;c.textAlign='center';c.textBaseline='middle';c.fillText('LIFE ROAD BANK',w/2,h/2+1)})}),0,5.2,3.4,b);
  worldG.add(b);
}

/* ---------- 人形（ピン） ---------- */
const LOOK={
 '会社員':{body:0x2a3b6e,acc:['tie','bag']},'販売員':{body:0xffffff,acc:['apron:0xff9a3d']},'コック':{body:0xffffff,hat:'toque'},
 '美容師':{body:0x222222,acc:['pouch']},'大工':{body:0xd98c2b,hat:'helmet:0xffd23f',acc:['belt']},'バス運転手':{body:0x2e5aa8,hat:'peaked:0x1d2f58',acc:['glove']},
 '農家':{body:0x3d6fb5,hat:'straw'},'警察官':{body:0x2a4a9a,hat:'peaked:0x16286a',acc:['badge']},'消防士':{body:0xd6402b,hat:'helmet:0xe8302b'},
 '保育士':{body:0xffffff,acc:['apron:0xff9ec4']},'動画配信者':{body:0x7a5cff,acc:['phones']},'医者':{body:0xffffff,acc:['stetho']},
 '弁護士':{body:0x333344,acc:['badge','bag']},'パイロット':{body:0x1d2f58,hat:'peaked:0x1d2f58',acc:['epaulet']},'エンジニア':{body:0x4a8f5a,acc:['laptop']},
 '教師':{body:0xb9926b,acc:['pointer']},'研究者':{body:0xffffff,acc:['glasses']},'建築家':{body:0x222222,acc:['roll']},'獣医':{body:0x5cb85c,acc:['badge']},
 'ゲームクリエイター':{body:0x3fb5d9,acc:['pad']},'プロスポーツ選手':{body:0xff6a2b,acc:['ball']},'宇宙飛行士':{body:0xf4f4f4,hat:'visor'}
};
function makeDoll(o){
  const g=new THREE.Group(),look=o.job?LOOK[o.job]||{}:{};
  const body=look.body??o.color;
  mesh(G_('dbody',()=>new THREE.CylinderGeometry(.1,.15,.34,12)),mat(body,90),0,.17,0,g);
  mesh(G_('dhead',()=>new THREE.SphereGeometry(.13,14,12)),mat(o.skin||0xffd9b3,60),0,.47,0,g);
  [-.05,.05].forEach(z=>mesh(G_('deye',()=>new THREE.SphereGeometry(.018,6,6)),mat(0x222222),.12,.5,z,g));
  if(look.body!==undefined&&o.color!==undefined)mesh(G_('dscarf',()=>new THREE.TorusGeometry(.105,.03,6,14)),mat(o.color,90),0,.335,0,g).rotation.x=Math.PI/2;   // 制服でも選んだ服の色がマフラーで見える
  if(o.gender){                                                   // せいべつ：髪型とスカート
    const hc=o.hair??0x4a3426,hm=mat(hc,40);
    mesh(G_('hcap',()=>new THREE.SphereGeometry(.142,14,8,0,Math.PI*2,0,Math.PI*.4)),hm,-.005,.48,0,g);
    mesh(G_('hback',()=>new THREE.SphereGeometry(.142,14,8,Math.PI+.95,Math.PI*2-1.9,Math.PI*.38,Math.PI*.36)),hm,-.005,.48,0,g);
    if(o.gender==='f'){
      mesh(G_('hlong',()=>new THREE.BoxGeometry(.07,.24,.25)),hm,-.115,.38,0,g);
      [-.125,.125].forEach(z=>mesh(G_('hside',()=>new THREE.SphereGeometry(.05,8,6)),hm,-.02,.4,z,g));
      mesh(G_('dskirt',()=>new THREE.CylinderGeometry(.1,.21,.13,14)),mat(body,90),0,.08,0,g);
      mesh(G_('hribbon',()=>new THREE.SphereGeometry(.035,6,6)),mat(0xff6fa5,80),-.02,.62,.1,g);
    }else if(o.gender==='m'){
      mesh(G_('hfront',()=>new THREE.BoxGeometry(.05,.04,.16)),hm,.1,.6,0,g);
    }else{
      mesh(G_('htuft',()=>new THREE.ConeGeometry(.04,.1,6)),hm,0,.64,0,g);
      mesh(G_('hside2',()=>new THREE.SphereGeometry(.05,8,6)),hm,-.08,.42,.1,g);
    }
  }
  const part=(s)=>{const a=s.split(':');return[a[0],a[1]?parseInt(a[1]):null]};
  if(look.hat){
    const[h,c]=part(look.hat);
    if(h==='toque'){mesh(new THREE.CylinderGeometry(.12,.1,.18,10),mat(0xffffff),0,.66,0,g);mesh(new THREE.SphereGeometry(.15,10,8),mat(0xffffff),0,.78,0,g)}
    if(h==='helmet'){const m=mesh(new THREE.SphereGeometry(.15,12,8,0,Math.PI*2,0,Math.PI/2),mat(c,100),0,.52,0,g);mesh(new THREE.CylinderGeometry(.17,.17,.02,12),mat(c,100),0,.52,0,g)}
    if(h==='peaked'){mesh(new THREE.CylinderGeometry(.15,.15,.1,12),mat(c,70),0,.6,0,g);mesh(new THREE.BoxGeometry(.14,.02,.2),mat(0x111111),.1,.56,0,g)}
    if(h==='straw'){mesh(new THREE.CylinderGeometry(.28,.28,.02,16),mat(0xf0d48a,20),0,.57,0,g);mesh(new THREE.CylinderGeometry(.12,.13,.1,12),mat(0xf0d48a,20),0,.63,0,g)}
    if(h==='visor'){mesh(new THREE.SphereGeometry(.19,12,10),new THREE.MeshPhongMaterial({color:0xcfe9ff,transparent:true,opacity:.45,shininess:120}),0,.47,0,g)}
  }
  (look.acc||[]).forEach(s=>{
    const[a,c]=part(s);
    if(a==='tie')mesh(new THREE.BoxGeometry(.03,.2,.04),mat(0xe8454c),.13,.22,0,g);
    if(a==='bag')mesh(new THREE.BoxGeometry(.1,.1,.08),mat(0x553322),.0,.1,.17,g);
    if(a==='apron')mesh(new THREE.BoxGeometry(.04,.22,.2),mat(c,60),.13,.14,0,g);
    if(a==='pouch')mesh(new THREE.BoxGeometry(.08,.08,.08),mat(0xc9a36a),.0,.08,-.16,g);
    if(a==='belt')mesh(new THREE.CylinderGeometry(.14,.14,.04,12),mat(0x7a4a2a),0,.1,0,g);
    if(a==='glove'){mesh(new THREE.SphereGeometry(.045,6,6),mat(0xffffff),.02,.14,.17,g);mesh(new THREE.SphereGeometry(.045,6,6),mat(0xffffff),.02,.14,-.17,g)}
    if(a==='badge')mesh(new THREE.CylinderGeometry(.035,.035,.02,10),mat(0xffd23f,120),.13,.26,.05,g).rotation.z=Math.PI/2;
    if(a==='phones'){const t=mesh(new THREE.TorusGeometry(.14,.025,6,14,Math.PI),mat(0x222222),0,.52,0,g);t.rotation.y=Math.PI/2}
    if(a==='stetho'){const t=mesh(new THREE.TorusGeometry(.09,.015,6,12),mat(0x222222),.1,.3,0,g);t.rotation.y=Math.PI/2}
    if(a==='epaulet'){[-.1,.1].forEach(z=>mesh(new THREE.BoxGeometry(.05,.02,.06),mat(0xffd23f,120),0,.33,z,g))}
    if(a==='laptop')mesh(new THREE.BoxGeometry(.12,.02,.16),mat(0x888899),.1,.12,.15,g);
    if(a==='pointer')mesh(new THREE.CylinderGeometry(.008,.008,.35,5),mat(0xdddddd),.1,.25,.16,g).rotation.z=.8;
    if(a==='glasses')[-.05,.05].forEach(z=>mesh(new THREE.TorusGeometry(.03,.007,5,10),mat(0x111111),.13,.5,z,g).rotation.y=Math.PI/2);
    if(a==='roll')mesh(new THREE.CylinderGeometry(.03,.03,.2,8),mat(0xf3f0e0),.1,.18,-.15,g).rotation.x=Math.PI/2;
    if(a==='pad')mesh(new THREE.BoxGeometry(.08,.03,.14),mat(0x222222),.12,.14,.15,g);
    if(a==='ball')mesh(new THREE.SphereGeometry(.06,8,8),mat(0xffffff),.12,.1,.15,g);
  });
  g.scale.setScalar(o.scale||1);return g;
}
function makePet(scale=1,col=0xb5763a,species='dog'){
  const g=new THREE.Group();
  mesh(new THREE.SphereGeometry(.13,10,8),mat(col,60),0,.13,0,g).scale.set(1.3,.9,.9);
  mesh(new THREE.SphereGeometry(.09,10,8),mat(col,60),.16,.24,0,g);
  const dark=0x2a2a2a;
  if(species==='cat'){
    [-.055,.055].forEach(z=>{const e=mesh(new THREE.ConeGeometry(.04,.1,4),mat(col,60),.15,.34,z,g);e.rotation.x=z>0?-.2:.2});
    [-.05,.05].forEach(z=>mesh(new THREE.SphereGeometry(.014,6,6),mat(0x58c46a),.235,.26,z*.7,g));
    mesh(new THREE.SphereGeometry(.012,6,6),mat(0xff8aa0),.25,.235,0,g);
    const t=mesh(new THREE.CylinderGeometry(.014,.014,.26,5),mat(col,60),-.2,.3,0,g);t.rotation.z=.35;      // 長いしっぽ
  }else{
    [-.07,.07].forEach(z=>{const e=mesh(new THREE.SphereGeometry(.04,8,6),mat(col,60),.13,.27,z,g);e.scale.set(.6,1.3,.6)});   // たれ耳
    mesh(new THREE.SphereGeometry(.045,8,6),mat(0xf6efe0,60),.23,.22,0,g);
    mesh(new THREE.SphereGeometry(.015,6,6),mat(dark),.27,.23,0,g);
    [-.04,.04].forEach(z=>mesh(new THREE.SphereGeometry(.013,6,6),mat(dark),.24,.27,z,g));
    mesh(new THREE.CylinderGeometry(.015,.015,.14,5),mat(col,60),-.17,.22,0,g).rotation.z=.9;
  }
  g.scale.setScalar(scale);return g;
}
const SEATS=[[.25,-.17],[.25,.17],[-.1,-.17],[-.1,.17],[-.45,-.17],[-.45,.17]];
const KID_COL=[0x7fd1ff,0xffd166,0xb4f06c,0xffa6d1,0xc9b4ff];

/* ---------- 車 ---------- */
function makeCar(p){
  const g=new THREE.Group(),car={g,p,wheels:[],styleSig:'',target:new V3(),anim:false,heading:0};
  mesh(new THREE.BoxGeometry(1.5,.3,.8),mat(p.color,100),0,.32,0,g);
  mesh(new THREE.BoxGeometry(.5,.16,.76),mat(p.color,100),.6,.5,0,g);
  mesh(new THREE.BoxGeometry(.1,.18,.7),mat(0xffffff,100),.78,.28,0,g);
  mesh(new THREE.BoxGeometry(.1,.18,.7),mat(0x666666,100),-.78,.28,0,g);
  [-.3,.3].forEach(z=>mesh(new THREE.SphereGeometry(.07,8,6),mat(0xfff3a0,100,{emissive:0x886600}),.78,.38,z,g));
  [[.5,.45],[.5,-.45],[-.5,.45],[-.5,-.45]].forEach(a=>{
    const w=new THREE.Group();w.position.set(a[0],.17,a[1]);
    const t=mesh(new THREE.CylinderGeometry(.17,.17,.14,14),mat(0x222222,30),0,0,0,w);t.rotation.x=Math.PI/2;
    const h=mesh(new THREE.CylinderGeometry(.09,.09,.16,10),mat(0xdddddd,120),0,0,0,w);h.rotation.x=Math.PI/2;
    g.add(w);car.wheels.push(w);
  });
  SEATS.forEach(s=>mesh(new THREE.BoxGeometry(.26,.02,.26),mat(0x2a2236,20),s[0],.485,s[1],g));   // 座席の穴6つ
  car.seatG=new THREE.Group();car.seatG.position.y=.49;g.add(car.seatG);
  car.styleG=new THREE.Group();g.add(car.styleG);
  car.stackG=new THREE.Group();car.stackG.position.set(-.1,.02,.95);g.add(car.stackG);
  car.stacks=[0xffffff,0xc8e86a,0xffa23d,0x8c7bff,0xffd23f].map((c,i)=>{
    const m=mesh(new THREE.BoxGeometry(.22,1,.11),mat(c,40),-.5+i*.26,0,0,car.stackG);m.scale.y=.001;return m;
  });
  car.ring=mesh(new THREE.TorusGeometry(1.1,.08,8,28),mat(0xffe27a,120,{emissive:0x886600}),0,.1,0,g);car.ring.rotation.x=Math.PI/2;car.ring.visible=false;
  const sh=mesh(new THREE.CircleGeometry(.95,18),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.22}),0,.02,0,g);sh.rotation.x=-Math.PI/2;
  g.position.copy(POS[p.pos]).setY(.3);car.target.copy(g.position);
  cars[p.id]=car;worldG.add(g);refreshCar(p);return car;
}
function refreshCar(p){
  const car=cars[p.id];if(!car)return;
  const vint=p.items.some(i=>i.c==='vcar'),sig=[p.cloth,p.gender,p.job&&p.job.n,p.spouse,p.spouseInfo&&p.spouseInfo.cloth+p.spouseInfo.gender,p.petList.map(x=>x.species+x.col).join(','),p.lover,p.kids,p.grand,p.pets,vint,p.carLevel].join('|');
  if(sig===car.styleSig)return;car.styleSig=sig;
  while(car.seatG.children.length)car.seatG.remove(car.seatG.children[0]);
  while(car.styleG.children.length)car.styleG.remove(car.styleG.children[0]);
  const list=[{k:'driver'}];
  if(p.spouse)list.push({k:'spouse'});else if(p.lover)list.push({k:'lover'});
  for(let i=0;i<p.kids;i++)list.push({k:'kid',i});
  for(let i=0;i<p.grand;i++)list.push({k:'grand',i});
  for(let i=0;i<p.pets;i++)list.push({k:'pet',pt:p.petList[i]});
  list.slice(0,PIN_MAX).forEach((e,i)=>{
    let d;
    if(e.k==='driver')d=makeDoll({color:p.cloth,gender:p.gender,job:p.job&&!p.retired?p.job.n:null,scale:.95});
    else if(e.k==='spouse'){const sp=p.spouseInfo;d=makeDoll({color:sp?sp.cloth:0xff8fb5,gender:sp?sp.gender:(p.gender==='f'?'m':'f'),scale:.9});mesh(new THREE.TorusGeometry(.03,.01,5,10),mat(0xffd23f,120),.1,.2,.0,d)}
    else if(e.k==='lover')d=makeDoll({color:0xffb6cf,gender:p.gender==='f'?'m':'f',scale:.88});
    else if(e.k==='kid')d=makeDoll({color:KID_COL[e.i%5],gender:e.i%2?'f':'m',scale:.7});
    else if(e.k==='grand')d=makeDoll({color:KID_COL[(e.i+2)%5],gender:e.i%2?'m':'f',scale:.55});
    else d=makePet(.9,e.pt?e.pt.col:0xb5763a,e.pt?e.pt.species:'dog');
    d.position.set(SEATS[i][0],0,SEATS[i][1]);d.userData.ph=Math.random()*6;car.seatG.add(d);
  });
  if(p.carLevel>=1)mesh(new THREE.BoxGeometry(.5,.02,.12),mat(0xffffff,100),.6,.59,0,car.styleG);
  if(p.carLevel>=2)mesh(new THREE.BoxGeometry(.1,.02,.7),mat(0x222222,100),-.74,.62,0,car.styleG);
  if(p.carLevel>=3)[[-.74,.62],[-.74,-.62]].forEach(a=>mesh(new THREE.BoxGeometry(.04,.16,.04),mat(0x222222),a[0]+.02,.54,a[1]*.0+(a[1]>0?.3:-.3),car.styleG));
  if(vint){[[.5,.45],[.5,-.45],[-.5,.45],[-.5,-.45]].forEach(a=>{const f=mesh(new THREE.SphereGeometry(.22,10,8),mat(0xf4efe0,100),a[0],.3,a[1]*1.08,car.styleG);f.scale.set(1.3,.7,.5)});
    mesh(new THREE.CylinderGeometry(.05,.05,.3,8),mat(0xdddddd,120),.82,.5,0,car.styleG).rotation.x=Math.PI/2}
  car.baseScale=1+Math.min(.2,p.carLevel*.05);car.g.scale.setScalar(car.baseScale);
}
function cheer(p){const c=cars[p.id];if(!c)return;anim(700,k=>c.seatG.children.forEach((d,i)=>{d.position.y=Math.abs(Math.sin(k*Math.PI*2+i*.4))*.28*(1-k*.4)}))}   // ジャンプして喜ぶ
function sad(p){const c=cars[p.id];if(!c)return;anim(800,k=>c.seatG.children.forEach(d=>{d.rotation.y=Math.sin(k*Math.PI*5)*.6*(1-k)}))}                  // 首を振ってがっかり
function layoutAll(){
  const by={};G.players.forEach(p=>{(by[p.pos]=by[p.pos]||[]).push(p)});
  for(const k in by){
    const arr=by[k],n=arr.length;
    arr.forEach((p,i)=>{
      const c=cars[p.id];if(!c)return;
      const a=n>1?(i/n)*Math.PI*2+Math.PI/4:0,r=n>1?(n>3?.95:.7):0,base=POS[k];
      c.target.set(base.x+Math.cos(a)*r,.3,base.z+Math.sin(a)*r);
      const h=HEAD[k];c.heading=Math.atan2(-h.z,h.x);
    });
  }
}
V.step=async(p,key)=>{
  const car=cars[p.id];if(!car)return;
  layoutAll();car.anim=true;Sound.step();
  const a=car.g.position.clone(),b=car.target.clone(),d=b.clone().sub(a);
  if(d.lengthSq()>.0001)car.g.rotation.y=Math.atan2(-d.z,d.x);
  await anim(300,k=>{
    car.g.position.lerpVectors(a,b,k).y=.3+Math.sin(k*Math.PI)*.35;
    car.wheels.forEach(w=>w.rotation.z-=.4);
  });
  car.g.position.copy(b);car.anim=false;
};
V.pins=refreshCar;
V.upgradeCar=p=>{refreshCar(p);V.confetti(p.pos)};
V.finishCar=async p=>{const c=cars[p.id];if(!c)return;c.ring.visible=false;await anim(900,k=>{c.g.rotation.y+=.25;c.g.position.y=.3+Math.abs(Math.sin(k*Math.PI*3))*.6})};
function updateStacks(){
  G.players.forEach(p=>{
    const c=cars[p.id];if(!c)return;
    let v=Math.max(0,p.cash);const den=[100000,50000,10000,5000,1000],cnt=[];
    den.forEach(d=>{const n=Math.floor(v/d);v-=n*d;cnt.push(n)});
    c.stacks.forEach((s,i)=>{const n=Math.min(cnt[4-i],26);s.scale.y=Math.max(.001,n*.05);s.position.y=s.scale.y/2});
  });
}

/* ---------- お札（Canvas 2Dで描いたテクスチャ） ---------- */
const BILL={1000:{c1:'#f2fbff',c2:'#7fc8f2',ic:'🚲'},5000:{c1:'#d9f08a',c2:'#8fc83c',ic:'🎓'},10000:{c1:'#ffd08a',c2:'#ff9a2e',ic:'⚙️'},50000:{c1:'#b6a8ff',c2:'#7655e8',ic:'🔔'},100000:{c1:'#ffe27a',c2:'#ff5a4a',ic:'👑'}};
function billTexture(den){
  return G_('bill'+den,()=>canvasTex(440,200,(ctx,w,h)=>{
    const b=BILL[den],gr=ctx.createLinearGradient(0,0,w,h);gr.addColorStop(0,b.c1);gr.addColorStop(1,b.c2);
    ctx.fillStyle=gr;rr(ctx,0,0,w,h,14);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=5;rr(ctx,9,9,w-18,h-18,10);ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=2;ctx.beginPath();for(let x=18;x<w-18;x+=2){const y=18+Math.sin(x*.18)*4;x===18?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke();
    ctx.beginPath();for(let x=18;x<w-18;x+=2){const y=h-18+Math.sin(x*.18)*4;x===18?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.4)';ctx.beginPath();ctx.arc(w/2,h/2+6,56,0,7);ctx.fill();         // マスコットの透かし
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.arc(w/2-18,h/2,5,0,7);ctx.arc(w/2+18,h/2,5,0,7);ctx.fill();ctx.beginPath();ctx.arc(w/2,h/2+14,16,0.1,Math.PI-.1);ctx.stroke();
    ctx.font='60px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.ic,w/2,h/2+10);
    ctx.fillStyle='#2a2540';ctx.font=`900 22px ${FONT}`;ctx.fillText('LIFE ROAD BANK',w/2,34);
    const t=den.toLocaleString('en-US');ctx.font=`900 34px ${FONT}`;
    ctx.textAlign='left';ctx.fillText(t,22,64);ctx.textAlign='right';ctx.fillText(t,w-22,h-44);
    ctx.textAlign='left';ctx.font=`700 15px ${FONT}`;ctx.fillText('LR-'+String(100000+Math.floor(Math.random()*899999)),24,h-24);
    ctx.textAlign='right';ctx.fillText(t+'円',w-24,h-24);
    if(den===100000){const hg=ctx.createLinearGradient(0,0,0,h);['#f55','#fd5','#5f8','#5df','#a6f'].forEach((c,i)=>hg.addColorStop(i/4,c));ctx.globalAlpha=.55;ctx.fillStyle=hg;ctx.fillRect(w-96,12,26,h-24);ctx.globalAlpha=1}   // ホログラム帯
  }));
}
let billGeo=null;
function getBillGeo(){
  if(billGeo)return billGeo;
  billGeo=new THREE.PlaneGeometry(1.1,.5,8,1);billGeo.rotateX(-Math.PI/2);
  const p=billGeo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,Math.sin(p.getX(i)*2.6)*.06);   // 少し反らせる
  billGeo.computeVertexNormals();return billGeo;
}
const billMat={};
function billList(amt){
  const L=[],den=[100000,50000,10000,5000,1000];let v=amt;
  for(const d of den){while(v>=d&&L.length<10){L.push(d);v-=d}}
  if(!L.length)L.push(1000);return L;
}
function endPoint(x){
  if(x==='bank')return BANK_POS.clone().add(new V3(4,1.6,0));
  const c=cars[x.id];return c?c.g.position.clone().setY(1.5):ROUL_POS.clone();
}
function flyBill(den,a,b){
  const m=billMat[den]||(billMat[den]=new THREE.MeshBasicMaterial({map:billTexture(den),side:THREE.DoubleSide}));
  const o=new THREE.Mesh(getBillGeo(),m);o.position.copy(a);scene.add(o);
  const spin=(Math.random()-.5)*8,hgt=3+Math.random()*3;
  return anim(800,k=>{
    const e=ease(k);o.position.lerpVectors(a,b,e);o.position.y+=Math.sin(k*Math.PI)*hgt;
    o.rotation.y=spin*k;o.rotation.z=Math.sin(k*9)*.5;o.scale.setScalar(1+Math.sin(k*Math.PI)*.4);
  }).then(()=>scene.remove(o));
}
V.bills=async(from,to,amt)=>{
  const list=billList(amt),a=endPoint(from),b=endPoint(to);
  if(from==='bank'||to==='bank')bankOpen();
  Sound.bill();
  await Promise.all(list.map((d,i)=>sleep(i*80).then(()=>flyBill(d,a,b))));
  Sound.coin();updateStacks();
  if(to!=='bank'&&to&&to.id!==undefined)cheer(to);
  if(from!=='bank'&&from&&from.id!==undefined)sad(from);
};
let bankOpenT=0;
function bankOpen(){bankOpenT=performance.now()+900/SPD}
V.noteStamp=async p=>{await sleep(350)};

/* ---------- ルーレット ---------- */
// 流れ：①「回す」で回り始める → ②「ストップ」で止める。止まった目はその瞬間に決まり、減速して針の位置に止まる
V.roulette=async(p,purpose)=>{
  await V.waitSpin(p,purpose,'start');
  await V.rouletteStart(purpose);
  await V.waitSpin(p,purpose,'stop');
  const r=1+rnd(10);
  await V.rouletteStop(r);
  return r;
};
V.rouletteStart=async purpose=>{                // 全員の画面でカメラが真上に寄り、盤が回り始める
  Cam.rouletteView=true;Roul.free=true;Roul.speed=0;Roul.last=-1;
  await sleep(900);
};
V.rouletteStop=async r=>{                       // ストップ：回転がだんだん遅くなって針の下で止まる
  const TAU=Math.PI*2,sec=Math.PI/5,cur=roulDisc.rotation.y,w=Math.max(Roul.speed,3);
  const target=-(r-1+.5)*sec+(Math.random()-.5)*sec*.6;
  const d=(((target-cur)%TAU)+TAU)%TAU,n=Math.ceil((d+TAU*.9)/TAU),dist=d-TAU*n;   // 必ず0.9周以上、負方向に回って止まる
  Roul.free=false;let last=-1;
  await anim(Math.abs(dist)*2/w*1000,k=>{
    const e=1-(1-k)*(1-k);roulDisc.rotation.y=cur+dist*e;
    const idx=Math.floor(-roulDisc.rotation.y/sec);if(idx!==last){last=idx;Sound.tick()}
  });
  Sound.spinStop();V.bigNum(r);
  await sleep(1000);Cam.rouletteView=false;await sleep(350);
};
function updateRoulette(dt){                    // 回転中（ストップを待っている間）
  if(!Roul.free||!roulDisc)return;
  Roul.speed+=(Roul.max-Roul.speed)*Math.min(1,dt*2.5);
  roulDisc.rotation.y-=Roul.speed*dt;
  const idx=Math.floor(-roulDisc.rotation.y/(Math.PI/5));if(idx!==Roul.last){Roul.last=idx;Sound.tick()}
}

/* ---------- 家・紙吹雪・ふきだし ---------- */
function houseModel(h){
  const g=new THREE.Group(),n=h.n;
  const box=(w,hh,d,c,x,y,z)=>mesh(new THREE.BoxGeometry(w,hh,d),mat(c,70),x,y,z,g);
  const win=(x,y,z,s=.7)=>mesh(new THREE.BoxGeometry(s,s,.1),mat(0xbfe6ff,120),x,y,z,g);
  if(n==='ワンルームマンション'){box(3.2,6,3,0xe8e0d0,0,3,0);for(let f=0;f<3;f++)[-.9,.9].forEach(x=>win(x,1.2+f*2,1.55));box(3.4,.3,3.2,0x8a8a99,0,6.1,0)}
  else if(n==='平屋'){box(5,2,3.4,0xfff0d0,0,1,0);const r=mesh(new THREE.ConeGeometry(4.2,1.8,4),mat(0xc0392b,70),0,2.9,0,g);r.rotation.y=Math.PI/4;box(5,.15,1,0x8a5a35,0,.3,2.2);win(-1.4,1.2,1.75);win(1.4,1.2,1.75)}
  else if(n==='ログハウス'){for(let i=0;i<6;i++)mesh(new THREE.CylinderGeometry(.35,.35,5,10),mat(0x9a6a3a,20),0,.4+i*.62,0,g).rotation.z=Math.PI/2;
    const r=mesh(new THREE.ConeGeometry(4,2,4),mat(0x5a3a2a,50),0,4.6,0,g);r.rotation.y=Math.PI/4;box(.8,2.2,.8,0x777777,1.6,4.6,-1);win(0,1.6,1.9)}
  else if(n==='2階建てファミリーハウス'){box(4.4,4,3.4,0xffffff,0,2,0);const r=mesh(new THREE.ConeGeometry(3.7,1.8,4),mat(0x3f8cff,70),0,4.9,0,g);r.rotation.y=Math.PI/4;[-1.3,1.3].forEach(x=>{win(x,1.2,1.75);win(x,3.0,1.75)});
    mesh(new THREE.CylinderGeometry(.05,.05,2,6),mat(0xff6b9d),3.4,1,2,g);mesh(new THREE.BoxGeometry(.7,.06,.3),mat(0xffc933),3.4,.7,2,g)}
  else if(n==='タワーマンション'){mesh(new THREE.BoxGeometry(3.2,13,3.2),new THREE.MeshPhongMaterial({color:0x9fd8ff,shininess:140,specular:0xffffff,transparent:true,opacity:.85}),0,6.5,0,g);for(let i=1;i<9;i++)box(3.3,.1,3.3,0xffffff,0,i*1.4,0);box(2,.8,2,0xffd23f,0,13.4,0)}
  else if(n==='海辺の豪邸'){box(6,2.4,3.6,0xffffff,0,1.2,0);box(4,2,3,0xffffff,0,3.4,0);box(6.4,.2,4,0x3f8cff,0,2.5,0);box(4.4,.2,3.4,0x3f8cff,0,4.5,0);win(-1.5,1.3,1.85,.9);win(1.5,1.3,1.85,.9);
    mesh(new THREE.BoxGeometry(4,.05,2.4),new THREE.MeshPhongMaterial({color:0x35b8ff,shininess:140}),0,.05,3.6,g);[-3.2,3.2].forEach(x=>{const t=tree(0,0,'palm',.8);worldG.remove(t);t.position.set(x,0,2);g.add(t)})}
  else{ // お城風の家
    box(5,3.4,3.4,0xe8dcc8,0,1.7,0);
    [[-2.6,-1.6],[2.6,-1.6],[-2.6,1.6],[2.6,1.6]].forEach(a=>{mesh(new THREE.CylinderGeometry(.8,.8,5,12),mat(0xf2e6d0,70),a[0],2.5,a[1],g);mesh(new THREE.ConeGeometry(1.1,1.8,12),mat(0xd0455a,70),a[0],5.9,a[1],g)});
    mesh(new THREE.CylinderGeometry(.06,.06,1.4,6),mat(0xffffff),0,5.4,0,g);mesh(new THREE.PlaneGeometry(1,.6),new THREE.MeshBasicMaterial({color:0xff4f86,side:THREE.DoubleSide}),.5,5.8,0,g);
    win(0,2,1.75,.9);mesh(new THREE.BoxGeometry(1.2,1.8,.1),mat(0x7a4a2a),0,.9,1.75,g)}
  return g;
}
V.buildHouse=async(p,h)=>{
  const n=houseSlots.length;houseSlots.push(p.id);
  const base=POS[70],out=base.clone().setY(0).normalize(),hd=HEAD[70],tang=hd.clone();
  const pos=base.clone().addScaledVector(out,9).addScaledVector(tang,((n%6)-2.5)*9).addScaledVector(out,Math.floor(n/6)*10);
  const g=houseModel(h);g.position.set(pos.x,0,pos.z);g.rotation.y=Math.atan2(-out.x,-out.z);g.scale.setScalar(.01);
  mesh(new THREE.CylinderGeometry(.05,.05,2,6),mat(0xffffff),-2.4,1,2.6,g);mesh(new THREE.PlaneGeometry(.9,.55),new THREE.MeshBasicMaterial({color:p.color,side:THREE.DoubleSide}),-2.0,1.8,2.6,g);
  worldG.add(g);
  const sp=pos.clone().setY(2);V.confetti(sp);Sound.pop();
  await anim(700,k=>g.scale.setScalar(Math.max(.01,easeBack(k))));
};
V.confetti=at=>{
  const o=typeof at==='string'?POS[at].clone():at.clone();o.y=Math.max(o.y,1.2);
  const cs=[0xff6b9d,0xffd23f,0x4aa3ff,0x4cd68a,0xb98cff];
  for(let i=0;i<46;i++){
    const m=new THREE.Mesh(G_('cf',()=>new THREE.PlaneGeometry(.22,.12)),new THREE.MeshBasicMaterial({color:cs[rnd(5)],side:THREE.DoubleSide}));
    m.position.copy(o);scene.add(m);
    confetti.push({m,v:new V3((Math.random()-.5)*7,4+Math.random()*7,(Math.random()-.5)*7),life:0,rs:new V3(Math.random()*9,Math.random()*9,Math.random()*9)});
  }
};
V.bubble=(key,text)=>{
  V.bubbleOff();
  const t=canvasTex(512,200,(c,w,h)=>{
    c.fillStyle='#fff';rr(c,6,6,w-12,h-40,28);c.fill();c.strokeStyle=hex(TILE_COL[SQ[key].c]);c.lineWidth=9;c.stroke();
    c.fillStyle='#fff';c.beginPath();c.moveTo(w/2-24,h-36);c.lineTo(w/2,h-4);c.lineTo(w/2+24,h-36);c.fill();
    c.fillStyle='#3b2f4a';c.font=`900 32px ${FONT}`;c.textAlign='center';c.textBaseline='middle';
    const lines=[];let cur='';for(const ch of text){cur+=ch;if(cur.length>=13){lines.push(cur);cur=''}}if(cur)lines.push(cur);
    lines.slice(0,3).forEach((l,i,a)=>c.fillText(l,w/2,(h-40)/2+(i-(a.length-1)/2)*38));
  });
  bubbleSpr=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));
  const p=POS[key];bubbleSpr.position.set(p.x,4.6,p.z);bubbleSpr.scale.set(8,3.1,1);bubbleSpr.renderOrder=9;scene.add(bubbleSpr);
};
V.bubbleOff=()=>{if(bubbleSpr){scene.remove(bubbleSpr);bubbleSpr=null}};
V.flash=key=>{const t=TILE[key];if(!t)return;anim(600,k=>{t.g.scale.set(1+Math.sin(k*Math.PI)*.3,1+Math.sin(k*Math.PI)*.6,1+Math.sin(k*Math.PI)*.3)})};

/* ---------- 職業カードの肖像（別WebGLで1枚ずつ描画してキャッシュ） ---------- */
let portR=null,portScene=null,portCam=null;const portCache={};
function portrait(job,p){
  const cloth=p?p.cloth:0x3f8cff,gender=p?p.gender:'n';
  const k=(job?job.n:'-')+'|'+cloth+'|'+gender;if(portCache[k])return portCache[k];
  try{
    if(!portR)portraitInit();
    const d=makeDoll({color:cloth,gender,job:job?job.n:null,scale:1});d.rotation.y=-.6;portScene.add(d);
    portR.setClearColor(0x000000,0);portR.render(portScene,portCam);portScene.remove(d);
    return portCache[k]=portR.domElement.toDataURL('image/png');
  }catch(e){return ''}
}
/* アバター選択のプレビュー：選んだ服・せいべつの人形が選んだ色の車に乗っている */
let prevR=null,prevScene=null,prevCam=null;
function renderAvatar(av){
  try{
    if(!prevR){prevR=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});prevR.setSize(240,170);prevScene=new THREE.Scene();
      prevScene.add(new THREE.HemisphereLight(0xffffff,0x99aabb,1.1));const dl=new THREE.DirectionalLight(0xffffff,.8);dl.position.set(2,4,4);prevScene.add(dl);
      prevCam=new THREE.PerspectiveCamera(30,240/170,.1,50);prevCam.position.set(2.3,1.5,3.4);prevCam.lookAt(.05,.45,0)}
    const g=new THREE.Group();
    mesh(new THREE.BoxGeometry(1.5,.3,.8),mat(av.car,100),0,.32,0,g);mesh(new THREE.BoxGeometry(.5,.16,.76),mat(av.car,100),.6,.5,0,g);
    mesh(new THREE.BoxGeometry(.1,.18,.7),mat(0xffffff,100),.78,.28,0,g);mesh(new THREE.BoxGeometry(.1,.18,.7),mat(0x666666,100),-.78,.28,0,g);
    [-.3,.3].forEach(z=>mesh(new THREE.SphereGeometry(.07,8,6),mat(0xfff3a0,100,{emissive:0x886600}),.78,.38,z,g));
    [[.5,.45],[.5,-.45],[-.5,.45],[-.5,-.45]].forEach(a=>{const t=mesh(new THREE.CylinderGeometry(.17,.17,.14,14),mat(0x222222,30),a[0],.17,a[1],g);t.rotation.x=Math.PI/2});
    mesh(new THREE.BoxGeometry(.26,.02,.26),mat(0x2a2236,20),.25,.485,-.1,g);
    const d=makeDoll({color:av.cloth,gender:av.gender,scale:1.7});d.position.set(.25,.49,-.1);g.add(d);
    g.rotation.y=-.35;prevScene.add(g);
    prevR.setClearColor(0x000000,0);prevR.render(prevScene,prevCam);prevScene.remove(g);
    return prevR.domElement.toDataURL('image/png');
  }catch(e){return ''}
}

function portraitPet(pt){
  const k='pet|'+pt.species+'|'+pt.col;if(portCache[k])return portCache[k];
  try{
    if(!portR){portraitInit()}
    const d=makePet(2.7,pt.col,pt.species);d.rotation.y=-.7;d.position.set(-.1,-.02,0);portScene.add(d);
    portR.setClearColor(0x000000,0);portR.render(portScene,portCam);portScene.remove(d);
    return portCache[k]=portR.domElement.toDataURL('image/png');
  }catch(e){return ''}
}
function portraitInit(){
  portR=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});portR.setSize(150,130);portScene=new THREE.Scene();
  portScene.add(new THREE.HemisphereLight(0xffffff,0x99aabb,1.1));const dl=new THREE.DirectionalLight(0xffffff,.7);dl.position.set(2,3,4);portScene.add(dl);
  portCam=new THREE.PerspectiveCamera(30,150/130,.1,50);portCam.position.set(1.4,.9,2.6);portCam.lookAt(0,.4,0);
  portCam2=new THREE.PerspectiveCamera(30,150/130,.1,50);portCam2.position.set(.75,.62,1.25);portCam2.lookAt(0,.4,0);   // 顔・上半身の寄り
}
let portCam2=null;

function portraitBust(c){                       // プロフィール用：顔が大きく写る写真
  const k='bust|'+c.cloth+'|'+c.gender;if(portCache[k])return portCache[k];
  try{
    if(!portR)portraitInit();
    const d=makeDoll({color:c.cloth,gender:c.gender,scale:1});d.rotation.y=-.5;portScene.add(d);
    portR.setClearColor(0x000000,0);portR.render(portScene,portCam2);portScene.remove(d);
    return portCache[k]=portR.domElement.toDataURL('image/png');
  }catch(e){return ''}
}
