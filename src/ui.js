// ===== UI：カード表示・HUD・手持ちカード・タイトル・結果 =====
const CAR_COLS=[0xe63946,0x1d7ae0,0x2fb36f,0xf4a100,0x8e44ad,0xff6fa5,0xff7a1a,0x17c3d4,0x8ac926,0x2b2b3a];
const CLOTH_COLS=[0xff5a5f,0x3f8cff,0x37c486,0xffc933,0x8e6bff,0xff8fc0,0xff9a3d,0x4dd0e1,0xb6e04a,0x3b2f4a,0xffffff,0x8b5a2b];
const PCOL=CAR_COLS.slice(0,6);
const GENDERS=[['m','👦 男の子'],['f','👧 女の子'],['n','🧑 ひみつ']];
const defAv=i=>({gender:i%2?'f':'m',cloth:CLOTH_COLS[(i*5+1)%CLOTH_COLS.length],car:CAR_COLS[i%CAR_COLS.length]});
const cleanAv=(a,i=0)=>({gender:'mfn'.includes(a&&a.gender)&&a&&a.gender?a.gender:'n',cloth:CLOTH_COLS.includes(a&&a.cloth)?a.cloth:CLOTH_COLS[0],car:CAR_COLS.includes(a&&a.car)?a.car:CAR_COLS[i%CAR_COLS.length]});
let AV=[],selRow=0;
const DEF_NAME=['あなた','タロウ','ハナ','ケン','ミキ','ソラ'];
const ITEM_ICON={health:'🏥',car:'🚗',fire:'🔥',sec:'🛡️',turbo:'🎟️',coin:'🪙',back:'⏪',nap:'😴',coupon:'🏷️',boost:'🎉',swap:'🔄',map:'🗺️',key:'🔑',watch:'⌚',neck:'💎',vcar:'🚙',paint:'🖼️',vase:'🏺',ball:'⚾',bonsai:'🌳'};
let cardOpen=false,logOn=false;
const prevCash={};

/* ---------- カード（マスの内容・選択） ---------- */
let cardCloseFn=null;
function cardLocal(o,p){
  if(cardCloseFn)cardCloseFn();
  return new Promise(res=>{
    cardOpen=true;
    const wrap=$('#cardWrap'),head=$('#cardHead');wrap.classList.toggle('spec',!!o.spec);
    head.textContent=(o.head||'')+(o.spec&&p?`（${p.name}）`:'');head.style.background=o.color||'#3f8cff';
    $('#cardTitle').innerHTML=o.title||'';
    let t=o.text||'';
    if(o.jobs)t='<div style="display:flex;gap:6px;justify-content:center;margin-bottom:6px">'+o.jobs.map(j=>`<img src="${portrait(j,p)}" width="86" style="border-radius:10px;background:#eaf6ff">`).join('')+'</div>'+t;
    $('#cardText').innerHTML=t;
    const a=$('#cardAmt');a.textContent=o.amt||'';a.className=o.amtCls||'';
    const bx=$('#cardBtns');bx.innerHTML='';bx.className=o.col?'col':'';
    const done=i=>{if(!cardOpen)return;cardOpen=false;cardCloseFn=null;removeEventListener('keydown',key);wrap.classList.add('hidden');wrap.classList.remove('spec');Sound.click();res(i)};
    const key=e=>{if((e.code==='Enter'||e.code==='Space')&&!o.cpu&&!o.spec&&(o.btns||['OK']).length===1){e.preventDefault();done(0)}};
    cardCloseFn=()=>done(-1);                       // 外部（観戦終了）から閉じる用
    wrap.classList.remove('hidden');
    if(o.spec){return}                              // 観戦：ボタンなし。他の人の操作が終わると閉じる
    (o.btns||['OK']).forEach((b,i)=>{
      const e=document.createElement('button');e.innerHTML=b;e.className=o.profile?'prof':(i>0?'alt':'');e.onclick=()=>done(i);bx.appendChild(e);
    });
    addEventListener('keydown',key);
    if(o.cpu){setTimeout(()=>{
      const bs=bx.children;if(bs[o.pick||0])bs[o.pick||0].style.outline='4px solid #ffc933';
      setTimeout(()=>done(o.pick||0),(o.btns&&o.btns.length>1?700:200)/SPD);
    },900/SPD)}
  });
}
V.card=cardLocal;

/* ---------- トースト・ログ・数字・バナー ---------- */
let toastT=0;
V.toast=m=>{const t=$('#toast');t.textContent=m;t.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(()=>t.style.opacity=0,3200)};
V.log=m=>{const b=$('#logBox'),d=document.createElement('div');d.textContent=m;b.prepend(d);while(b.children.length>60)b.removeChild(b.lastChild)};
V.bigNum=r=>{
  let e=$('#bigNum');if(!e){e=document.createElement('div');e.id='bigNum';e.style.cssText='position:fixed;left:0;right:0;top:30%;text-align:center;font-size:clamp(80px,22vw,190px);font-weight:900;color:#fff;text-shadow:0 6px 0 #ff4f86,0 12px 20px #0006;z-index:20;pointer-events:none;transition:all .6s';document.body.appendChild(e)}
  e.textContent=r;e.style.opacity=1;e.style.transform='scale(1)';
  setTimeout(()=>{e.style.opacity=0;e.style.transform='scale(1.5) translateY(-40px)'},900/SPD);
};
V.banner=txt=>{const b=$('#banner');b.textContent=txt;b.classList.remove('hidden');b.style.animation='none';void b.offsetWidth;b.style.animation='';setTimeout(()=>b.classList.add('hidden'),2500)};
V.chapter=(ch,p)=>{if(p&&ch>(p.maxCh||0)){p.maxCh=ch;V.banner(CHAPTER_NAME[ch]);Sound.good()}};

/* ---------- ターン開始（マリオパーティ風：なまえ ターン！ ＋ その人にズーム） ---------- */
V.turnIntro=async(p,label='ターン！')=>{
  Cam.introUntil=performance.now()+1900/SPD;
  const b=$('#turnBanner');
  b.innerHTML=`<span class="tb-n" style="background:${hex(p.color)}">${esc(p.name)}</span><span class="tb-t">${label}</span>`;
  b.classList.remove('hidden');b.style.animation='none';void b.offsetWidth;b.style.animation='';
  Sound.coin();
  await sleep(1900);
  b.classList.add('hidden');
};

/* ---------- ルーレットボタン ---------- */
V.waitSpin=(p,purpose,phase='start')=>new Promise(res=>{
  if(p.cpu||AUTO){setTimeout(res,(phase==='stop'?400+rnd(900):650)/SPD);return}
  const b=$('#spinBtn');
  if(phase==='start'){b.textContent=purpose==='move'?`🎯 ${p.name}：ルーレットを回す`:purpose==='bonus'?`🎁 ${p.name}：ボーナスルーレット！`:`🎰 ${p.name}：勝負のルーレット！`;b.className='go'}
  else{b.textContent='✋ ストップ！';b.className='stop';V.toast('好きなタイミングでストップを押そう！')}
  const go=()=>{b.classList.add('hidden');b.onclick=null;removeEventListener('keydown',key);Sound.resume();res()};
  const key=e=>{if((e.code==='Space'||e.code==='Enter')&&!cardOpen){e.preventDefault();go()}};
  b.onclick=go;addEventListener('keydown',key);
});

/* ---------- HUD / プレイヤー一覧 / 手持ちカード ---------- */
function houseCardHtml(h){return `<div class="ic">🏠</div><div class="tt">${esc(h.n)}</div>`}
V.hud=()=>{
  if(!G.players.length)return;
  const turnP=G.players[G.cur],cur=(NET.on&&G.players[NET.myPid])||turnP;
  G.players.forEach(refreshCar);updateStacks();
  // 左：プレイヤー一覧（総資産ランキング順）
  const ord=[...G.players].sort((a,b)=>(b.finished?b.final:assetsOf(b))-(a.finished?a.final:assetsOf(a)));
  $('#plist').innerHTML=ord.map((p,i)=>`<div class="pl ${p===turnP?'cur':''} ${p.finished?'fin':''}"><span>${i+1}</span><span class="dot" style="background:${hex(p.color)}"></span><span class="nm">${esc(p.name)}${p.cpu?'🤖':''}</span><small class="ag">${ageOfKey(p.pos)}歳</small><span class="as">${fmt(p.finished?p.final:assetsOf(p))}</span></div>`).join('');
  // 右上：手番プレイヤー
  const m=$('#money');
  $('#hudName').innerHTML=`<span style="color:${hex(cur.color)}">●</span> ${esc(cur.name)} ${cur.cpu?'🤖':''} <span class="age">🎂 ${ageOfKey(cur.pos)}歳 ${{stroller:'🍼',bike:'🚲',car:'🚗',chair:'🧑‍🦽',echair:'🦼',scooter:'🛵'}[cur.vstage]||''}</span> <span class="hp">😊${happinessOf(cur)}</span>`;
  m.textContent=fmt(cur.cash)+'円';
  const pv=prevCash[cur.id];
  if(pv!==undefined&&pv!==cur.cash){m.className=cur.cash>pv?'up':'down';setTimeout(()=>m.className='',700)}
  G.players.forEach(p=>prevCash[p.id]=p.cash);
  $('#hudNote').innerHTML=`📜 約束手形 ${cur.notes}枚${cur.notes?`（返済 ${fmt(cur.notes*NOTE_BACK)}円）`:''}`;
  const marks=[cur.promo?`昇進×${cur.promo}`:'',cur.qual?`資格×${cur.qual}`:'',cur.president?'社長':'',cur.abroad?'留学':'',cur.halfPay?'給料半分':'',cur.coupon?'🏷クーポン待機':'',cur.booster?'🎉ブースター待機':'',cur.redShield?'🛡ドック':'',cur.skip?'💤1回休み':'',cur.jobless?'🥲失業中×'+cur.jobless:'',cur.spouseJobless?'🥲相手失業×'+cur.spouseJobless:''].filter(Boolean).join(' ');
  $('#hudJob').innerHTML=`💼 ${cur.retired?'退職（年金）':cur.job?esc(cur.job.n)+'（'+fmt(salaryOf(cur))+'）':'学生'} ${marks}`;
  const kidIcons=cur.kidList.map(k=>k.gender==='f'?'👧':'👦').join('');
  const fam=[cur.spouse?'💍'+(cur.spouseInfo?esc(cur.spouseInfo.name):'配偶者'):cur.lover?'💗'+(cur.loverInfo?esc(cur.loverInfo.name):'恋人'):'',cur.affairInfo?'🖤'+esc(cur.affairInfo.name):'',kidIcons,cur.grand?'🧒×'+cur.grand:'',cur.pets?cur.petList.map(x=>x.species==='cat'?'🐱':'🐶').join(''):''].filter(Boolean).join(' ');
  $('#hudFam').innerHTML=fam||'👤ひとり';
  renderHand(cur);
};
const DENS=[100000,50000,10000,5000,1000];
const billImg={};
const billURL=d=>billImg[d]||(billImg[d]=billTexture(d).image.toDataURL('image/png'));
function breakdown(cash){let v=Math.max(0,cash);return DENS.map(d=>{const n=Math.floor(v/d);v-=n*d;return[d,n]})}
function renderHand(p){
  const h=$('#hand');h.innerHTML='';
  const mk=c=>{const d=document.createElement('div');d.className='hc '+c.cls;d.innerHTML=c.html;return d};
  // 種類ごとのまとまり。1枚ならそのまま、複数枚なら少しずつずらして重ね、重なりが見えるようにする（タップで広げる）
  const group=(label,cards,wide)=>{
    const g=document.createElement('div');g.className='hg';g.innerHTML=`<div class="hl">${label}${cards.length>1?` <span class="gc">×${cards.length}</span>`:''}</div><div class="hrow"></div>`;
    const row=g.querySelector('.hrow');h.appendChild(g);
    if(cards.length===1){const d=mk(cards[0]);d.onclick=cards[0].fn;row.appendChild(d);return}
    const st=document.createElement('div');st.className='stack'+(wide?' wide':'');st.style.setProperty('--n',Math.min(cards.length,4));
    cards.slice(-4).forEach((c,i)=>{const d=mk(c);d.style.setProperty('--i',i);st.appendChild(d)});    // 少しずらして重ね、枚数がわかるようにする
    const top=st.lastChild;const bd2=document.createElement('span');bd2.className='cnt';bd2.textContent='×'+cards.length;top.appendChild(bd2);
    st.onclick=()=>openGroupPopup(label,cards);                                                          // タップでポップアップに全部表示
    row.appendChild(st);
  };
  // 💰 財布：お札の枚数（高額順）
  const bd=breakdown(p.cash);
  group('💰 財布',[{cls:'wallet',html:`<div class="wt">${fmt(p.cash)}円</div><div class="wb">${bd.map(([d,n])=>`<div class="wi ${n?'':'zero'}"><img src="${billURL(d)}" alt=""><b>×${n}</b></div>`).join('')}</div>`,fn:()=>zoom(p,'wallet')}]);
  // 💼 職業カード
  group('💼 職業',[p.job&&!p.retired?{cls:'job '+(p.job.deck==='s'?'sp':''),html:`<img src="${portrait(p.job,p)}"><div class="tt">${esc(p.job.n)}</div>`,fn:()=>zoom(p,'job')}
    :{cls:'empty',html:`<div class="ic">${p.retired?'🌴':'🎓'}</div><div class="tt">${p.retired?'退職':'学生'}</div>`,fn:()=>{}}]);
  // 💍 配偶者
  if(p.spouseInfo){const c=p.spouseInfo;group('💍 配偶者',[{cls:'mate',html:`<img src="${portraitBust(c)}"><div class="tt">${esc(c.name)}</div>`,fn:()=>zoom(p,'spouse')}])}
  // 💗 恋人 / 🖤 愛人
  if(p.loverInfo){const c=p.loverInfo;group('💗 恋人',[{cls:'mate',html:`<img src="${portraitBust(c)}"><div class="tt">${esc(c.name)}</div>`,fn:()=>zoom(p,'lover')}])}
  if(p.affairInfo){const c=p.affairInfo;group('🖤 愛人',[{cls:'mate',html:`<img src="${portraitBust(c)}"><div class="tt">${esc(c.name)}</div>`,fn:()=>zoom(p,'affair')}])}
  // 👶 子ども
  if(p.kidList.length)group('👶 子ども',p.kidList.map(k=>({cls:'mate',html:`<img src="${portraitBust({cloth:k.cloth,gender:k.gender})}"><div class="tt">${esc(k.name)}</div>`,fn:()=>zoom(p,'kid',k)})));
  // 🐾 ペット
  if(p.petList.length)group('🐾 ペット',p.petList.map(pt=>({cls:'mate',html:`<img src="${portraitPet(pt)}"><div class="tt">${esc(pt.name)}</div>`,fn:()=>zoom(p,'pet',pt)})));
  // 💎 お宝カード
  const cols=p.items.filter(i=>i.ty==='col');
  if(cols.length)group('💎 お宝',cols.map(it=>({cls:'col',html:`<div class="ic">${ITEM_ICON[it.c]||'💎'}</div><div class="tt">${esc(it.n)}</div>`,fn:()=>zoom(p,'item',it)})));
  // 🎁 アイテムカード（保険・使い切り）
  const its=p.items.filter(i=>i.ty!=='col');
  if(its.length)group('🎁 アイテム',its.map(it=>({cls:it.ty,html:`<div class="ic">${ITEM_ICON[it.c]||'🎁'}</div><div class="tt">${esc(it.n)}</div>`,fn:()=>zoom(p,'item',it)})));
  // 🏠 家カード
  if(p.houses.length)group('🏠 家',p.houses.map(hs=>({cls:'house',html:houseCardHtml(hs),fn:()=>zoom(p,'house',hs)})),true);
  // 📈 株券
  if(p.stocks.length)group('📈 株券',p.stocks.map(n=>({cls:'stock',html:`<div class="big">${n}</div><div class="tt">株券 ${n}</div>`,fn:()=>zoom(p,'stock',n)})));
  // 📜 約束手形
  if(p.notes)group('📜 手形',[{cls:'note',html:`<div class="big">×${p.notes}</div><div class="tt">返済 ${fmt(p.notes*NOTE_BACK)}円</div>`,fn:()=>zoom(p,'note')}]);
}
function openGroupPopup(label,cards){            // 同じ種類のカードを、ポップアップで全部見せる
  const grid=$('#gpGrid');grid.innerHTML='';$('#gpTitle').textContent=`${label}（${cards.length}枚）`;
  cards.forEach(c=>{const d=document.createElement('div');d.className='hc '+c.cls;d.innerHTML=c.html;d.onclick=()=>{closeGroupPopup();c.fn()};grid.appendChild(d)});
  $('#groupPop').classList.remove('hidden');
}
function closeGroupPopup(){$('#groupPop').classList.add('hidden')}
$('#gpClose').onclick=closeGroupPopup;$('#groupPop').onclick=e=>{if(e.target.id==='groupPop')closeGroupPopup()};
async function zoom(p,type,x){
  if(cardOpen)return;
  let o;
  if(type==='wallet'){
    const bd=breakdown(p.cash);
    o={head:'💰 財布',color:'#c98a00',title:`${fmt(p.cash)}円`,text:`<table class="tbl">${bd.map(([d,n])=>`<tr><td><img src="${billURL(d)}" width="78" style="vertical-align:middle;border-radius:4px"> ${fmt(d)}円</td><td>×${n}</td><td>${fmt(d*n)}円</td></tr>`).join('')}</table>${p.notes?`<div class="minus" style="margin-top:6px">📜 約束手形 ${p.notes}枚（返済 ${fmt(p.notes*NOTE_BACK)}円）</div>`:'<div style="margin-top:6px;color:#887">約束手形はありません</div>'}<div style="margin-top:6px">総資産（見込み）<b> ${fmt(assetsOf(p))}円</b></div>`};
  }
  else if(type==='spouse')o={head:'💍 配偶者',color:'#ff6fa5',title:esc(p.spouseInfo.name),text:`<div class="prof zoomprof">${spouseHtml(p.spouseInfo)}</div>`};
  else if(type==='lover')o={head:'💗 恋人',color:'#ff6fa5',title:esc(p.loverInfo.name),text:`<div class="prof zoomprof">${spouseHtml(p.loverInfo)}</div>`};
  else if(type==='affair')o={head:'🖤 愛人',color:'#6a4fd0',title:esc(p.affairInfo.name),text:`<div class="prof zoomprof">${spouseHtml(p.affairInfo)}</div>`};
  else if(type==='kid')o={head:'👶 子ども',color:'#ff9a3d',title:esc(x.name),text:`<div class="prof zoomprof"><img class="pimg" src="${portraitBust({cloth:x.cloth,gender:x.gender})}" alt=""><div class="pi"><b>${esc(x.name)}</b>（${x.gender==='f'?'女の子':'男の子'}）<br>今 ${Math.max(0,ageOfKey(p.pos)-x.bornAge)}歳</div></div>`};
  else if(type==='pet')o={head:'🐾 ペット',color:'#ff9a3d',title:esc(x.name),text:`<div class="prof zoomprof">${petHtml(x)}</div>`};
  else if(type==='note')o={head:'約束手形',color:'#e8454c',title:`${p.notes}枚`,text:`1枚につき ${fmt(NOTE_LOAN)}円 を借りています。<br>返すときは1枚 ${fmt(NOTE_BACK)}円（ゴールで自動返済）。<br>合計の返済額：<b class="minus">${fmt(p.notes*NOTE_BACK)}円</b>`};
  else if(type==='job')o={head:'職業カード',color:p.job.deck==='s'?'#c98a00':'#3f8cff',title:esc(p.job.n),text:`<img src="${portrait(p.job,p)}" width="120"><br>給料 ${fmt(p.job.sal)}円（昇進×${p.promo}で ${fmt(salaryOf(p))}円）<br>特殊能力：${esc(p.job.abt)}<br><small>${esc(p.job.look)}</small>`};
  else if(type==='item'){
    o={head:{ins:'アイテム（保険）',use:'アイテム（使い切り）',col:'お宝（コレクション）'}[x.ty],color:{ins:'#3f8cff',use:'#8e6bff',col:'#c98a00'}[x.ty],title:`${ITEM_ICON[x.c]||''} ${esc(x.n)}`,text:`${esc(x.eff)}<br>価値：${esc(x.v)}`};
  }
  else if(type==='house')o={head:'家カード',color:'#c98a00',title:esc(x.n),text:`購入価格 ${fmt(x.price)}円<br>ゴールでの売却額：${esc(x.sellt)}<br><small>${esc(x.look)}</small>`};
  else o={head:'株券',color:'#2fb36f',title:`株券 ${x}`,text:'誰かがこの数字を出すたび、配当 5,000円。<br>ゴールで 10,000円 で買い取られます。'};
  const actions=[];                                                           // [ボタン名, 実行する処理]
  const canUse=type==='item'&&G.awaiting===p&&!p.cpu&&usableItems(p).includes(x.c);
  if(canUse)actions.push(['使う',async()=>{if(G.awaiting!==p)return;if(NET.on&&!NET.isHost)NET.send({t:'useItem',c:x.c});else await useItem(p,x.c)}]);
  if((type==='wallet'||type==='note')&&p.notes>0){                            // 途中でも精算できる
    const can=Math.min(p.notes,Math.floor(p.cash/NOTE_BACK));
    const doRepay=n=>async()=>{if(NET.on&&!NET.isHost)NET.send({t:'repay',n});else await repayNotes(p,n)};
    if(can>=1)actions.push([`手形を1枚返す（${fmt(NOTE_BACK)}円）`,doRepay(1)]);
    if(can>=2)actions.push([`返せるだけ返す（${can}枚＝${fmt(can*NOTE_BACK)}円）`,doRepay(can)]);
    if(can<1)o.text+=`<div class="minus" style="margin-top:6px">現金が足りないので、まだ返せません（1枚 ${fmt(NOTE_BACK)}円）</div>`;
  }
  actions.push(['閉じる',async()=>{}]);
  const i=await cardLocal(Object.assign(o,{btns:actions.map(a=>a[0]),cpu:false,col:actions.length>2}),p);
  await actions[i][1]();
}

/* ---------- 結果 ---------- */
function drawChart(cv,players,key,yMin,yMax,fmtY){
  const ctx=cv.getContext('2d'),W=cv.width,H=cv.height,L=46,R=10,T=10,B=24;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,W,H);
  const maxAge=Math.max(80,...players.map(p=>Math.max(0,...(G.hist[p.id]||[]).map(x=>x.a))));
  const X=a=>L+(W-L-R)*a/maxAge,Y=v=>T+(H-T-B)*(1-(v-yMin)/(yMax-yMin||1));
  ctx.font='11px sans-serif';ctx.textBaseline='middle';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const v=yMin+(yMax-yMin)*i/4,y=Y(v);ctx.strokeStyle='#e8e2d4';ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(W-R,y);ctx.stroke();ctx.fillStyle='#887';ctx.textAlign='right';ctx.fillText(fmtY(v),L-4,y)}
  ctx.textAlign='center';ctx.textBaseline='top';
  for(let a=0;a<=maxAge;a+=20){ctx.fillStyle='#887';ctx.fillText(a+'歳',X(a),H-B+5);ctx.strokeStyle='#eee';ctx.beginPath();ctx.moveTo(X(a),T);ctx.lineTo(X(a),H-B);ctx.stroke()}
  players.forEach(p=>{
    const hs=G.hist[p.id]||[];if(!hs.length)return;
    ctx.strokeStyle=hex(p.color);ctx.fillStyle=hex(p.color);ctx.lineWidth=2.6;ctx.lineJoin='round';ctx.beginPath();
    hs.forEach((x,i)=>{const px=X(x.a),py=Y(x[key]);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();
    const e=hs[hs.length-1];ctx.beginPath();ctx.arc(X(e.a),Y(e[key]),4,0,7);ctx.fill();
  });
}
V.results=async()=>{
  Cam.rouletteView=false;
  const r=[...G.players].sort((a,b)=>b.final-a.final);
  Sound.fanfare();
  const medal=['🥇','🥈','🥉'];
  const lastH=p=>{const h=G.hist&&G.hist[p.id];return h&&h.length?h[h.length-1].h:0};
  const rows=r.map((p,i)=>`<tr><td>${medal[i]||(i+1)+'位'}</td><td><span style="color:${hex(p.color)}">●</span> ${esc(p.name)}${p.cpu?'🤖':''}${p.left?'（退出）':''}</td><td>${fmt(p.final)}円</td><td>😊${lastH(p)}</td></tr>`).join('');
  const happy=[...G.players].sort((a,b)=>lastH(b)-lastH(a))[0];
  const legend=G.players.map(p=>`<span style="color:${hex(p.color)};font-weight:800">● ${esc(p.name)}</span>`).join('　');
  const det=r.map(p=>`<details style="text-align:left;font-size:.8rem"><summary>${esc(p.name)} の内訳</summary><table class="tbl">${p.report.map(x=>`<tr><td>${esc(x[0])}</td><td class="${x[1]<0?'minus':''}">${fmt(x[1])}円</td></tr>`).join('')}${p.bonusTotal?`<tr><td>ボーナスルーレット合計（上がった後）</td><td>${fmt(p.bonusTotal)}円</td></tr>`:''}</table></details>`).join('');
  document.title=`LIFE ROAD 結果：優勝 ${r[0].name}`;
  window.__result={winner:r[0].name,ranking:r.map(p=>[p.name,p.final])};
  if(AUTO)return;
  const pr=cardLocal({head:'🏆 総資産ランキング',color:'#c98a00',wide:true,title:`${esc(r[0].name)} の優勝！`,text:`<table class="tbl"><tr><th>順位</th><th>名前</th><th>総資産</th><th>幸福度</th></tr>${rows}</table>
    <div style="margin:6px 0 2px">😊 いちばん幸せだったのは <b>${esc(happy.name)}</b>（${lastH(happy)}）</div>
    <div class="chartwrap"><b>😊 幸福度の推移</b><canvas id="chH" width="520" height="220"></canvas></div>
    <div class="chartwrap"><b>💰 総資産の推移</b><canvas id="chW" width="520" height="220"></canvas></div>
    <div style="font-size:.78rem;margin:4px 0">${legend}</div>${det}`,btns:['もう一度遊ぶ'],cpu:false},null);
  setTimeout(()=>{
    const cvH=$('#chH'),cvW=$('#chW');if(!cvH||!cvW)return;
    drawChart(cvH,G.players,'h',0,100,v=>Math.round(v));
    const mx=Math.max(100000,...G.players.map(p=>Math.max(...(G.hist[p.id]||[{w:0}]).map(x=>x.w))));
    const mn=Math.min(0,...G.players.map(p=>Math.min(...(G.hist[p.id]||[{w:0}]).map(x=>x.w))));
    drawChart(cvW,G.players,'w',mn,mx,v=>Math.round(v/10000)+'万');
  },60);
  await pr;
  location.reload();
};

/* ---------- 道具ボタン ---------- */
$('#btn2d').onclick=()=>{Cam.set2D(!Cam.is2D);$('#btn2d').textContent=Cam.is2D?'🎥 3D表示':'🗺 2D表示';Sound.click()};
$('#btnSnd').onclick=()=>{Sound.resume();$('#btnSnd').textContent=Sound.toggle()?'🔊':'🔇'};
$('#btnSpd').onclick=()=>{if(AUTO)return;SPD=SPD>=4?1:SPD*2;$('#btnSpd').textContent=`⏩ ×${SPD}`;Sound.click()};
$('#btnLog').onclick=()=>{logOn=!logOn;$('#logBox').classList.toggle('hidden',!logOn)};

/* ---------- タイトル画面 ---------- */
let avCb=null;
function loadMe(){
  try{const s=JSON.parse(localStorage.getItem('liferoad_me')||'null');if(s){const a=cleanAv(s,0);a.name=String(s.name||'あなた').slice(0,8);return a}}catch(e){}
  return{name:'あなた',gender:'mf'[rnd(2)],cloth:CLOTH_COLS[rnd(CLOTH_COLS.length)],car:CAR_COLS[rnd(CAR_COLS.length)]};
}
function saveMe(){try{localStorage.setItem('liferoad_me',JSON.stringify(AV[0]))}catch(e){}}
function renderAvatarEditor(){
  const av=AV[0];
  $('#avGender').innerHTML=GENDERS.map(g=>`<button data-g="${g[0]}" class="${av.gender===g[0]?'pink':'alt'}">${g[1]}</button>`).join('');
  $('#avGender').querySelectorAll('button').forEach(b=>b.onclick=()=>{av.gender=b.dataset.g;renderAvatarEditor()});
  $('#swCloth').innerHTML=CLOTH_COLS.map(c=>`<span data-c="${c}" class="${av.cloth===c?'sel':''}" style="background:${hex(c)}"></span>`).join('');
  $('#swCar').innerHTML=CAR_COLS.map(c=>`<span data-c="${c}" class="${av.car===c?'sel':''}" style="background:${hex(c)}"></span>`).join('');
  $('#swCloth').querySelectorAll('span').forEach(e=>e.onclick=()=>{av.cloth=+e.dataset.c;renderAvatarEditor()});
  $('#swCar').querySelectorAll('span').forEach(e=>e.onclick=()=>{av.car=+e.dataset.c;renderAvatarEditor()});
  $('#avPrev').src=renderAvatar(av);
}
function refreshAvIcon(){$('#avIconImg').src=renderAvatar(AV[0]);$('#avIconName').textContent=AV[0].name}
function openAvatar(cb){avCb=cb;$('#avName').value=AV[0].name;renderAvatarEditor();$('#avModal').classList.remove('hidden')}
function closeAvatar(){
  AV[0].name=($('#avName').value.trim()||'あなた').slice(0,8);saveMe();
  $('#avModal').classList.add('hidden');refreshAvIcon();
  const cb=avCb;avCb=null;if(cb)cb();
}
function buildTitle(){                                   // 保存済みのアバターを読み込む（なければランダム）
  AV[0]=loadMe();
  $('#avIcon').onclick=()=>openAvatar(null);$('#avDone').onclick=closeAvatar;
  refreshAvIcon();
}
function enterGameUI(){
  $('#titleScr').classList.add('hidden');
  ['#tools','#left','#hudR','#actions','#hand'].forEach(s=>$(s).classList.remove('hidden'));
  if(NET.on)$('#btnSpd').classList.add('hidden');
  if(NET.on&&NET.isHost&&TestMode.on)initTestPanel();
  G.players.forEach(p=>makeCar(p));
  layoutAll();G.players.forEach(p=>cars[p.id].g.position.copy(cars[p.id].target));
  V.setCamDefault();Cam.userAz=.6;
  G.players.forEach(p=>p.maxCh=0);
}
async function startGame(list){
  Sound.resume();
  setupGame(list);enterGameUI();
  V.hud();V.banner('LIFE ROAD スタート！');
  await sleep(1200);
  await playGame();
}
window.addEventListener('load',()=>{
  buildTitle();
  try{initWorld()}catch(e){
    $('#sub').innerHTML='⚠ このブラウザでは3D(WebGL)を使えません。別のブラウザでお試しください。<br><small>'+esc(e.message)+'</small>';
    console.error(e);return;
  }
  if(AUTO){
    const n=+((location.search.match(/n=(\d)/)||[])[1]||4);
    startGame(Array.from({length:n},(_,i)=>({name:'CPU'+(i+1),cpu:true,color:CAR_COLS[i],cloth:defAv(i).cloth,gender:defAv(i).gender})));
  }
});
