// ===== 3D ワールド（前半）：シーン・道・マス =====
const V3=THREE.Vector3;
let renderer,scene,camP,camO,cam,sun,hemi;
const POS={},HEAD={},TILE={};
let curveMain=null;const branchCurves={};
const worldG=new THREE.Group();
const TILE_COL={yellow:0xffd166,green:0x62d49a,red:0xff7f8a,blue:0x66b2ff,gold:0xf4bd3a};          // やわらかいが、ひと目で見分けられる5色
const SKY=[0xbfe6ff,0xcfe0f2,0xcdeeff,0xc2e0ff,0xffe0bd,0xffc7ad];
const GROUND=[0xd6f0b0,0xc8d0e0,0xc2e8b4,0xa9d3a8,0xf4c98e,0xf6e6bd];             // 章ごとの色（芝ににじませる淡い色）
const GROUND_BASE=0x9bd67e,SEA_COL=0x4fb0e0,SHALLOW_COL=0x7fd4e4,SAND_COL=0xf2dca6,RIVER_COL=0x66bfe8,RIVER_BANK=0xcfd49a;   // パステルの地形色
const FONT='"Hiragino Maru Gothic ProN","Yu Gothic","Meiryo",sans-serif';
const matCache={};
function mat(c,shin=80,extra){      // つやのあるプラスチック風
  const k=c+'_'+shin+(extra?JSON.stringify(extra):'');
  return matCache[k]||(matCache[k]=new THREE.MeshPhongMaterial(Object.assign({color:c,shininess:shin,specular:0x777777},extra||{})));
}
const geoCache={};
const G_=(k,f)=>geoCache[k]||(geoCache[k]=f());
// 色は「sRGBで書いた色」を、計算用のリニア色に1回だけ直す（sRGB出力＋トーンマッピングで正しく見せるため）
function lin(m){
  if(!m||m.userData.lin)return m;m.userData.lin=1;
  if(m.color)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();
  if((m.isMeshBasicMaterial&&m.map)||m.isSpriteMaterial)m.toneMapped=false;      // 看板・お札・文字は色をそのまま出す
  return m;
}
function linGeo(g){const c=g&&g.attributes&&g.attributes.color;if(!c||g.userData.lin)return;g.userData.lin=1;for(let i=0;i<c.count;i++)c.setXYZ(i,Math.pow(c.getX(i),2.2),Math.pow(c.getY(i),2.2),Math.pow(c.getZ(i),2.2))}
function mesh(geo,m,x=0,y=0,z=0,parent){
  lin(m);linGeo(geo);
  const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);if(parent)parent.add(o);return o;
}
function canvasTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t;
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
  }else if(kind==='ticket'){
    ctx.rotate(-.15);ctx.fillStyle='#fff3a0';ctx.strokeStyle='#c98a00';rr(ctx,-s*.4,-s*.26,s*.8,s*.52,s*.07);ctx.fill();ctx.stroke();
    ctx.fillStyle='#c98a00';ctx.font=`900 ${s*.3}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('宝',-s*.14,0);ctx.fillText('7',s*.2,0);
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
function tileTexture(sq){                                // マスの上面（256pxで高精細に）
  const base=TILE_COL[sq.c];
  const tex=canvasTex(256,256,(ctx)=>{
    ctx.scale(2,2);
    const g=ctx.createRadialGradient(52,46,6,64,64,70);g.addColorStop(0,'#ffffff');g.addColorStop(.35,hex(base));g.addColorStop(1,hex(base));
    ctx.fillStyle=hex(base);ctx.fillRect(0,0,128,128);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(64,64,58,0,7);ctx.fill();
    ctx.globalAlpha=.9;ctx.fillStyle=g;ctx.beginPath();ctx.arc(64,64,52,0,7);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=hex(base);ctx.globalAlpha=.72;ctx.beginPath();ctx.arc(64,64,52,0,7);ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(64,64,47,0,7);ctx.stroke();ctx.setLineDash([]);
    let icon={yellow:'coin',green:'clover',red:'warn',blue:'q',gold:'flag'}[sq.c];
    if(sq.c==='blue')icon={item:'card',duel:'roulette',family:'heart',job:'tie',event:'q',lottery:'ticket'}[sq.k];
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    ctx.lineWidth=6;ctx.strokeStyle='rgba(30,20,50,.55)';
    ctx.font=`900 28px ${FONT}`;const label=sq.id;ctx.strokeText(label,64,25);ctx.fillText(label,64,25);
    ctx.font=`900 15px ${FONT}`;ctx.lineWidth=4;const age=ageOfKey(sq.id)+'歳';
    const tw=ctx.measureText(age).width+12;ctx.fillStyle='rgba(30,20,50,.5)';rr(ctx,64-tw/2,37,tw,17,8);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(age,64,46);   // 年齢のラベル
    drawIcon(ctx,icon,64,83,42);
    if(sq.c==='gold'){const t=sq.id==='1'?'START':sq.id==='150'?'GOAL':'STOP';ctx.font=`900 15px ${FONT}`;ctx.lineWidth=4;ctx.strokeText(t,64,112);ctx.fillText(t,64,112)}
  });
  tex.anisotropy=8;return tex;
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
      A.clone().addScaledVector(nrm,out*.5).addScaledVector(f,-1.8),
      A.clone().addScaledVector(nrm,out).addScaledVector(f,-.9),
      B.clone().addScaledVector(nrm,out).addScaledVector(f,.9),               // 折り返しを広げる（マスどうしが重ならないように）
      B.clone().addScaledVector(nrm,out*.5).addScaledVector(f,1.8),B],false,'catmullrom',.5);
    c.arcLengthDivisions=800;branchCurves[prefix]=c;
    for(let j=1;j<=count;j++){const t=j/(count+1);POS[prefix+j]=c.getPointAt(t);HEAD[prefix+j]=c.getTangentAt(t).setY(0).normalize()}
    worldG.add(ribbon(c,120,2.9,0xfff4d6,.02),ribbon(c,120,3.4,{U:0xb6a2ff,W:0xffa66b,S:0x7fd6b0,R:0xff8aa8}[prefix],.01));
  }
  branch('U',12,20,21,-1,17);branch('W',8,20,21,1,12);
  branch('S',10,80,81,1,15);branch('R',10,80,81,-1,15);
  // 追加コース：本線から外へふくらんで、少し先で合流する
  function detour(prefix,count,fromN,toN,side,out,col){
    const A=POS[fromN].clone(),B=POS[toN].clone(),f=B.clone().sub(A).setY(0).normalize(),nrm=new V3(-f.z,0,f.x).multiplyScalar(side),M=A.clone().add(B).multiplyScalar(.5);
    const c=new THREE.CatmullRomCurve3([A,A.clone().addScaledVector(nrm,out*.6).addScaledVector(f,-out*.25),M.clone().addScaledVector(nrm,out),B.clone().addScaledVector(nrm,out*.6).addScaledVector(f,out*.25),B],false,'catmullrom',.5);
    c.arcLengthDivisions=800;branchCurves[prefix]=c;
    for(let j=1;j<=count;j++){const t=j/(count+1);POS[prefix+j]=c.getPointAt(t);HEAD[prefix+j]=c.getTangentAt(t).setY(0).normalize()}
    worldG.add(ribbon(c,140,2.9,0xfff4d6,.02),ribbon(c,140,3.4,col,.01));
  }
  DETOURS.forEach(d=>detour(...d));
}
const DETOURS=[['D',8,86,90,1,12,0xf2c14e],['C',8,86,90,-1,14,0x7fb2f0],['G',8,120,124,1,14,0xb06ad9]];   // 置ける場所を総当たりで調べて決めた位置
function buildTiles(){
  SQDATA.forEach(sq=>{
    const p=POS[sq.id],g=new THREE.Group();g.position.copy(p);
    const gold=sq.c==='gold',R=gold?1.12:.86;
    const dark=new THREE.Color(TILE_COL[sq.c]).multiplyScalar(.62).getHex();
    mesh(G_('tp'+R,()=>new THREE.CylinderGeometry(R*1.1,R*1.16,.16,40)),mat(dark,60),0,.08,0,g);                 // 濃い色の台座：厚みと輪郭を出す
    const base=mesh(G_('tb'+R,()=>new THREE.CylinderGeometry(R,R*1.05,.3,40)),mat(TILE_COL[sq.c],110),0,.15,0,g);
    mesh(G_('trim'+R,()=>new THREE.TorusGeometry(R*.97,.045,8,40)),mat(0xffffff,120),0,.3,0,g).rotation.x=Math.PI/2;      // 白いふちどり
    const top=mesh(G_('tt'+R,()=>new THREE.CircleGeometry(R*.93,40)),new THREE.MeshPhongMaterial({map:tileTexture(sq),shininess:60,specular:0x444444}),0,.31,0,g);
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
