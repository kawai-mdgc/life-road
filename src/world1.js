// ===== 3D ワールド（前半）：シーン・道・マス =====
const V3=THREE.Vector3;
let renderer,scene,camP,camO,cam,sun,hemi;
const POS={},HEAD={},TILE={};
let curveMain=null;const branchCurves={};
const worldG=new THREE.Group();
const TILE_COL={yellow:0xffd23f,green:0x4cd68a,red:0xff5d6c,blue:0x4aa3ff,gold:0xf5b800};
const SKY=[0x9fdcff,0xb9cfe6,0xbfe9ff,0xa9d3ff,0xffd2a1,0xff9a7d];
const GROUND=[0xa7e08f,0xb9bcc8,0x9ad884,0xa3c996,0xe0a964,0xf1dba3];
const FONT='"Hiragino Maru Gothic ProN","Yu Gothic","Meiryo",sans-serif';
const matCache={};
function mat(c,shin=80,extra){      // つやのあるプラスチック風
  const k=c+'_'+shin+(extra?JSON.stringify(extra):'');
  return matCache[k]||(matCache[k]=new THREE.MeshPhongMaterial(Object.assign({color:c,shininess:shin,specular:0x777777},extra||{})));
}
const geoCache={};
const G_=(k,f)=>geoCache[k]||(geoCache[k]=f());
function mesh(geo,m,x=0,y=0,z=0,parent){
  const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);if(parent)parent.add(o);return o;
}
function canvasTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
const hex=c=>'#'+c.toString(16).padStart(6,'0');

/* ---------- tween（setIntervalで駆動：非表示タブでも止まらない） ---------- */
const tweens=[];
function anim(ms,fn){
  return new Promise(res=>{tweens.push({t0:performance.now(),dur:Math.max(1,ms/SPD),fn,res})});
}
function updateTweens(){
  const now=performance.now();
  for(let i=tweens.length-1;i>=0;i--){
    const t=tweens[i],k=Math.min(1,(now-t.t0)/t.dur);
    t.fn(k);if(k>=1){tweens.splice(i,1);t.res()}
  }
}
const ease=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
const easeOut=k=>1-Math.pow(1-k,3);
const easeBack=k=>{const c=1.70158+1;return 1+c*Math.pow(k-1,3)+(c-1)*Math.pow(k-1,2)};

/* ---------- マスの絵柄（Canvas 2D） ---------- */
function drawIcon(ctx,kind,cx,cy,s){
  ctx.save();ctx.translate(cx,cy);ctx.lineWidth=s*.07;ctx.lineJoin='round';
  if(kind==='card'){                       // アイテム＝カード
    ctx.rotate(-.2);ctx.fillStyle='#fff';ctx.strokeStyle='#2a63c8';rr(ctx,-s*.3,-s*.4,s*.6,s*.8,s*.08);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffc933';star(ctx,0,0,s*.2,s*.09,5);ctx.fill();
  }else if(kind==='roulette'){             // 勝負＝ルーレット
    for(let i=0;i<10;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,s*.42,i*Math.PI/5,(i+1)*Math.PI/5);ctx.fillStyle=i%2?'#fff':'#ff4d5a';ctx.fill()}
    ctx.strokeStyle='#c98a00';ctx.beginPath();ctx.arc(0,0,s*.42,0,7);ctx.stroke();
    ctx.fillStyle='#ffc933';ctx.beginPath();ctx.arc(0,0,s*.09,0,7);ctx.fill();
  }else if(kind==='heart'){                // 家族＝ハート
    ctx.fillStyle='#ff4f86';ctx.strokeStyle='#fff';ctx.beginPath();
    ctx.moveTo(0,s*.38);ctx.bezierCurveTo(-s*.62,-s*.05,-s*.3,-s*.5,0,-s*.2);ctx.bezierCurveTo(s*.3,-s*.5,s*.62,-s*.05,0,s*.38);ctx.fill();ctx.stroke();
  }else if(kind==='tie'){                  // 職業＝ネクタイ
    ctx.fillStyle='#fff';ctx.strokeStyle='#2a63c8';ctx.beginPath();ctx.moveTo(-s*.3,-s*.4);ctx.lineTo(0,-s*.18);ctx.lineTo(s*.3,-s*.4);ctx.lineTo(s*.3,-s*.1);ctx.lineTo(0,s*.12);ctx.lineTo(-s*.3,-s*.1);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#e8454c';ctx.beginPath();ctx.moveTo(-s*.1,-s*.15);ctx.lineTo(s*.1,-s*.15);ctx.lineTo(s*.16,s*.2);ctx.lineTo(0,s*.42);ctx.lineTo(-s*.16,s*.2);ctx.closePath();ctx.fill();ctx.stroke();
  }else if(kind==='coin'){
    ctx.fillStyle='#fff3a0';ctx.strokeStyle='#c98a00';ctx.beginPath();ctx.arc(0,0,s*.38,0,7);ctx.fill();ctx.stroke();
    ctx.fillStyle='#c98a00';ctx.font=`900 ${s*.5}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('L',0,s*.03);
  }else if(kind==='clover'){
    ctx.fillStyle='#fff';for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2);ctx.beginPath();ctx.arc(s*.17,0,s*.17,0,7);ctx.fill();ctx.restore()}
    ctx.fillStyle='#2fb36f';ctx.fillRect(-s*.03,s*.1,s*.06,s*.3);
  }else if(kind==='warn'){
    ctx.fillStyle='#fff';ctx.strokeStyle='#c4202a';ctx.beginPath();ctx.moveTo(0,-s*.42);ctx.lineTo(s*.42,s*.34);ctx.lineTo(-s*.42,s*.34);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#c4202a';ctx.font=`900 ${s*.5}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',0,s*.1);
  }else if(kind==='q'){
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,s*.38,0,7);ctx.fill();
    ctx.fillStyle='#2a63c8';ctx.font=`900 ${s*.6}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',0,s*.04);
  }else if(kind==='flag'){
    ctx.fillStyle='#fff';ctx.fillRect(-s*.28,-s*.4,s*.07,s*.8);ctx.fillStyle='#e8454c';ctx.beginPath();ctx.moveTo(-s*.21,-s*.4);ctx.lineTo(s*.32,-s*.2);ctx.lineTo(-s*.21,0);ctx.fill();
  }
  ctx.restore();
}
function star(ctx,cx,cy,R,r,n){ctx.beginPath();for(let i=0;i<n*2;i++){const a=-Math.PI/2+i*Math.PI/n,rad=i%2?r:R;ctx.lineTo(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad)}ctx.closePath()}
function tileTexture(sq){
  const base=TILE_COL[sq.c];
  return canvasTex(128,128,(ctx,w,h)=>{
    ctx.fillStyle=hex(base);ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(64,64,56,0,7);ctx.fill();
    ctx.fillStyle=hex(base);ctx.beginPath();ctx.arc(64,64,50,0,7);ctx.fill();
    let icon={yellow:'coin',green:'clover',red:'warn',blue:'q',gold:'flag'}[sq.c];
    if(sq.c==='blue')icon={item:'card',duel:'roulette',family:'heart',job:'tie',event:'q'}[sq.k];
    ctx.fillStyle='#fff';ctx.font=`900 30px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.35)';
    ctx.font=`900 26px ${FONT}`;const label=sq.id;ctx.strokeText(label,64,24);ctx.fillText(label,64,24);
    ctx.font=`900 17px ${FONT}`;ctx.lineWidth=4;const age=ageOfKey(sq.id)+'歳';ctx.strokeText(age,64,44);ctx.fillText(age,64,44);   // マスの年齢
    drawIcon(ctx,icon,64,82,44);
    if(sq.c==='gold'){const t=sq.id==='1'?'START':sq.id==='150'?'GOAL':'STOP';ctx.font=`900 16px ${FONT}`;ctx.strokeText(t,64,111);ctx.fillText(t,64,111)}
  });
}

/* ---------- 道（曲がりくねった経路）とマスの配置 ---------- */
function ribbon(curve,n,w,color,y){
  const pts=curve.getSpacedPoints(n),pos=[],idx=[];
  pts.forEach((p,i)=>{
    const t=curve.getTangentAt(Math.min(1,i/n)),nx=-t.z*w/2,nz=t.x*w/2;
    pos.push(p.x+nx,y,p.z+nz,p.x-nx,y,p.z-nz);
    if(i<n){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}
  });
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  return new THREE.Mesh(g,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));
}
function buildPath(){
  const X=70,st=17.5,pts=[];
  for(let i=0;i<=8;i++)pts.push(new V3(-X+i*st,0,-36+(i%2?-7:7)));
  pts.push(new V3(X+14,0,-20),new V3(X+18,0,0),new V3(X+14,0,20));
  for(let i=8;i>=0;i--)pts.push(new V3(-X+i*st,0,36+(i%2?7:-7)));
  const curve=new THREE.CatmullRomCurve3(pts,false,'catmullrom',.4);curve.arcLengthDivisions=3000;curveMain=curve;
  for(let n=1;n<=150;n++){const t=(n-1)/149;POS[n]=curve.getPointAt(t);HEAD[n]=curve.getTangentAt(t).setY(0).normalize()}
  worldG.add(ribbon(curve,500,2.9,0xfff4d6,.02),ribbon(curve,500,3.4,0xe9b872,.01));
  // 分岐ルート
  function branch(prefix,count,fromN,toN,side,out){
    const A=POS[fromN].clone(),B=POS[toN].clone(),f=HEAD[fromN].clone(),nrm=new V3(-f.z,0,f.x).multiplyScalar(side);
    const c=new THREE.CatmullRomCurve3([A,
      A.clone().addScaledVector(nrm,out*.5).addScaledVector(f,-1.2),
      A.clone().addScaledVector(nrm,out).addScaledVector(f,1.2),
      B.clone().addScaledVector(nrm,out*.5).addScaledVector(f,1.2),B],false,'catmullrom',.5);
    c.arcLengthDivisions=800;branchCurves[prefix]=c;
    for(let j=1;j<=count;j++){const t=j/(count+1);POS[prefix+j]=c.getPointAt(t);HEAD[prefix+j]=c.getTangentAt(t).setY(0).normalize()}
    worldG.add(ribbon(c,120,2.9,0xfff4d6,.02),ribbon(c,120,3.4,{U:0xb6a2ff,W:0xffa66b,S:0x7fd6b0,R:0xff8aa8}[prefix],.01));
  }
  branch('U',12,20,21,-1,17);branch('W',8,20,21,1,12);
  branch('S',10,80,81,1,15);branch('R',10,80,81,-1,15);
}
function buildTiles(){
  SQDATA.forEach(sq=>{
    const p=POS[sq.id],g=new THREE.Group();g.position.copy(p);
    const gold=sq.c==='gold',R=gold?1.12:.86;
    const base=mesh(G_('tb'+R,()=>new THREE.CylinderGeometry(R,R*1.04,.3,28)),mat(TILE_COL[sq.c],90),0,.15,0,g);
    const top=mesh(G_('tt'+R,()=>new THREE.CircleGeometry(R*.92,28)),new THREE.MeshPhongMaterial({map:tileTexture(sq),shininess:60,specular:0x444444}),0,.31,0,g);
    top.rotation.x=-Math.PI/2;
    // 道の進行方向に文字の上が向くよう回転
    const h=HEAD[sq.id];top.rotation.z=Math.atan2(h.x,-h.z)*0+0;
    if(gold){
      mesh(G_('pole',()=>new THREE.CylinderGeometry(.05,.05,2.2,8)),mat(0xffffff),R*.7,1.3,-R*.5,g);
      const fl=mesh(G_('flag',()=>new THREE.PlaneGeometry(.9,.55)),new THREE.MeshPhongMaterial({color:0xf5b800,side:THREE.DoubleSide,shininess:60}),R*.7+.45,2,-R*.5,g);fl.userData.flag=1;
      mesh(G_('gring',()=>new THREE.TorusGeometry(R*1.02,.07,8,32)),mat(0xffe27a,100),0,.31,0,g).rotation.x=Math.PI/2;
    }
    worldG.add(g);TILE[sq.id]={g,base,top,sq};
  });
}
