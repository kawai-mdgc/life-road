// ===== UI：カード表示・HUD・手持ちカード・タイトル・結果 =====
const PCOL=[0xe63946,0x1d7ae0,0x2fb36f,0xf4a100,0x8e44ad,0xff6fa5];
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
    if(o.jobs)t='<div style="display:flex;gap:6px;justify-content:center;margin-bottom:6px">'+o.jobs.map(j=>`<img src="${portrait(j,p?p.color:0x3f8cff)}" width="86" style="border-radius:10px;background:#eaf6ff">`).join('')+'</div>'+t;
    $('#cardText').innerHTML=t;
    const a=$('#cardAmt');a.textContent=o.amt||'';a.className=o.amtCls||'';
    const bx=$('#cardBtns');bx.innerHTML='';bx.className=o.col?'col':'';
    const done=i=>{if(!cardOpen)return;cardOpen=false;cardCloseFn=null;removeEventListener('keydown',key);wrap.classList.add('hidden');wrap.classList.remove('spec');Sound.click();res(i)};
    const key=e=>{if((e.code==='Enter'||e.code==='Space')&&!o.cpu&&!o.spec&&(o.btns||['OK']).length===1){e.preventDefault();done(0)}};
    cardCloseFn=()=>done(-1);                       // 外部（観戦終了）から閉じる用
    wrap.classList.remove('hidden');
    if(o.spec){return}                              // 観戦：ボタンなし。他の人の操作が終わると閉じる
    (o.btns||['OK']).forEach((b,i)=>{
      const e=document.createElement('button');e.innerHTML=b;if(i>0)e.className='alt';e.onclick=()=>done(i);bx.appendChild(e);
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

/* ---------- ルーレットボタン ---------- */
V.waitSpin=(p,purpose)=>new Promise(res=>{
  if(p.cpu||AUTO){setTimeout(res,650/SPD);return}
  const b=$('#spinBtn');
  b.textContent=purpose==='move'?`🎯 ${p.name}：ルーレットを回す`:`🎰 ${p.name}：勝負のルーレット！`;
  b.classList.remove('hidden');
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
  $('#plist').innerHTML=ord.map((p,i)=>`<div class="pl ${p===turnP?'cur':''} ${p.finished?'fin':''}"><span>${i+1}</span><span class="dot" style="background:${hex(p.color)}"></span><span class="nm">${esc(p.name)}${p.cpu?'🤖':''}</span><span class="as">${fmt(p.finished?p.final:assetsOf(p))}</span></div>`).join('');
  // 右上：手番プレイヤー
  const m=$('#money');
  $('#hudName').innerHTML=`<span style="color:${hex(cur.color)}">●</span> ${esc(cur.name)} ${cur.cpu?'🤖':''}`;
  m.textContent=fmt(cur.cash)+' LD';
  const pv=prevCash[cur.id];
  if(pv!==undefined&&pv!==cur.cash){m.className=cur.cash>pv?'up':'down';setTimeout(()=>m.className='',700)}
  G.players.forEach(p=>prevCash[p.id]=p.cash);
  $('#hudNote').innerHTML=`📜 約束手形 ${cur.notes}枚${cur.notes?`（返済 ${fmt(cur.notes*NOTE_BACK)}）`:''}`;
  const marks=[cur.promo?`昇進×${cur.promo}`:'',cur.qual?`資格×${cur.qual}`:'',cur.president?'社長':'',cur.abroad?'留学':'',cur.halfPay?'給料半分':'',cur.coupon?'🏷クーポン待機':'',cur.booster?'🎉ブースター待機':'',cur.redShield?'🛡ドック':'',cur.skip?'💤1回休み':''].filter(Boolean).join(' ');
  $('#hudJob').innerHTML=`💼 ${cur.retired?'退職（年金）':cur.job?esc(cur.job.n)+'（'+fmt(salaryOf(cur))+'）':'学生'} ${marks}`;
  $('#hudFam').innerHTML=`${cur.spouse?'💍配偶者 ':cur.lover?'💗恋人 ':''}${cur.kids?'👶×'+cur.kids+' ':''}${cur.grand?'🧒孫×'+cur.grand+' ':''}${cur.pets?'🐶×'+cur.pets:''}${!(cur.spouse||cur.lover||cur.kids||cur.grand||cur.pets)?'👤ひとり':''}`;
  renderHand(cur);
};
function renderHand(p){
  const h=$('#hand');h.innerHTML='';
  const add=(cls,inner,fn)=>{const d=document.createElement('div');d.className='hc '+cls;d.innerHTML=inner;d.onclick=fn;h.appendChild(d)};
  if(p.job&&!p.retired)add('job '+(p.job.deck==='s'?'sp':''),`<img src="${portrait(p.job,p.color)}"><div class="tt">${esc(p.job.n)}</div>`,()=>zoom(p,'job'));
  p.items.forEach(it=>add(it.ty,`<div class="ic">${ITEM_ICON[it.c]||'🎁'}</div><div class="tt">${esc(it.n)}</div>`,()=>zoom(p,'item',it)));
  p.houses.forEach(hs=>add('house',houseCardHtml(hs),()=>zoom(p,'house',hs)));
  p.stocks.forEach(n=>add('stock',`<div class="big">${n}</div><div class="tt">株券 ${n}</div>`,()=>zoom(p,'stock',n)));
  if(!h.children.length)h.innerHTML='<div id="handEmpty">手持ちカードはまだありません</div>';
}
async function zoom(p,type,x){
  if(cardOpen)return;
  let o;
  if(type==='job')o={head:'職業カード',color:p.job.deck==='s'?'#c98a00':'#3f8cff',title:esc(p.job.n),text:`<img src="${portrait(p.job,p.color)}" width="120"><br>給料 ${fmt(p.job.sal)} LD（昇進×${p.promo}で ${fmt(salaryOf(p))} LD）<br>特殊能力：${esc(p.job.abt)}<br><small>${esc(p.job.look)}</small>`};
  else if(type==='item'){
    o={head:{ins:'アイテム（保険）',use:'アイテム（使い切り）',col:'アイテム（コレクション）'}[x.ty],color:{ins:'#3f8cff',use:'#8e6bff',col:'#c98a00'}[x.ty],title:`${ITEM_ICON[x.c]||''} ${esc(x.n)}`,text:`${esc(x.eff)}<br>価値：${esc(x.v)}`};
  }
  else if(type==='house')o={head:'家カード',color:'#c98a00',title:esc(x.n),text:`購入価格 ${fmt(x.price)} LD<br>ゴールでの売却額：${esc(x.sellt)}<br><small>${esc(x.look)}</small>`};
  else o={head:'株券',color:'#2fb36f',title:`株券 ${x}`,text:'誰かがこの数字を出すたび、配当 5,000 LD。<br>ゴールで 10,000 LD で買い取られます。'};
  const btns=['閉じる'];
  const canUse=type==='item'&&G.awaiting===p&&!p.cpu&&usableItems(p).includes(x.c);
  if(canUse)btns.unshift('使う');
  const i=await cardLocal(Object.assign(o,{btns,cpu:false}),p);
  if(canUse&&i===0&&G.awaiting===p){if(NET.on&&!NET.isHost)NET.send({t:'useItem',c:x.c});else await useItem(p,x.c)}
}

/* ---------- 結果 ---------- */
V.results=async()=>{
  Cam.rouletteView=false;
  const r=[...G.players].sort((a,b)=>b.final-a.final);
  Sound.fanfare();
  const medal=['🥇','🥈','🥉'];
  const rows=r.map((p,i)=>`<tr><td>${medal[i]||(i+1)+'位'}</td><td><span style="color:${hex(p.color)}">●</span> ${esc(p.name)}${p.cpu?'🤖':''}</td><td>${fmt(p.final)}</td></tr>`).join('');
  const det=r.map(p=>`<details style="text-align:left;font-size:.8rem"><summary>${esc(p.name)} の内訳</summary><table class="tbl">${p.report.map(x=>`<tr><td>${esc(x[0])}</td><td class="${x[1]<0?'minus':''}">${fmt(x[1])}</td></tr>`).join('')}</table></details>`).join('');
  document.title=`LIFE ROAD 結果：優勝 ${r[0].name}`;
  window.__result={winner:r[0].name,ranking:r.map(p=>[p.name,p.final])};
  if(AUTO)return;
  await cardLocal({head:'🏆 総資産ランキング',color:'#c98a00',title:`${esc(r[0].name)} の優勝！`,text:`<table class="tbl"><tr><th>順位</th><th>名前</th><th>総資産(LD)</th></tr>${rows}</table>${det}`,btns:['もう一度遊ぶ'],cpu:false},null);
  location.reload();
};

/* ---------- 道具ボタン ---------- */
$('#btn2d').onclick=()=>{Cam.set2D(!Cam.is2D);$('#btn2d').textContent=Cam.is2D?'🎥 3D表示':'🗺 2D表示';Sound.click()};
$('#btnSnd').onclick=()=>{Sound.resume();$('#btnSnd').textContent=Sound.toggle()?'🔊':'🔇'};
$('#btnSpd').onclick=()=>{if(AUTO)return;SPD=SPD>=4?1:SPD*2;$('#btnSpd').textContent=`⏩ ×${SPD}`;Sound.click()};
$('#btnLog').onclick=()=>{logOn=!logOn;$('#logBox').classList.toggle('hidden',!logOn)};

/* ---------- タイトル画面 ---------- */
let pcount=4;
function buildTitle(){
  $('#cnt').innerHTML=[2,3,4,5,6].map(n=>`<button class="${n===pcount?'on':''}" data-n="${n}">${n}人</button>`).join('');
  $('#cnt').querySelectorAll('button').forEach(b=>b.onclick=()=>{pcount=+b.dataset.n;buildTitle()});
  const old=[...$('#prows').children].map(r=>({name:r.querySelector('input').value,cpu:r.querySelector('button').dataset.cpu==='1'}));
  $('#prows').innerHTML='';
  for(let i=0;i<pcount;i++){
    const o=old[i]||{name:DEF_NAME[i],cpu:i>0},d=document.createElement('div');d.className='prow';
    d.innerHTML=`<span class="dot" style="background:${hex(PCOL[i])}"></span><input type="text" maxlength="8" value="${esc(o.name)}"><button data-cpu="${o.cpu?1:0}" class="${o.cpu?'alt':'green'}">${o.cpu?'🤖 CPU':'🙂 人間'}</button>`;
    const b=d.querySelector('button');
    b.onclick=()=>{const c=b.dataset.cpu==='1'?0:1;b.dataset.cpu=c;b.textContent=c?'🤖 CPU':'🙂 人間';b.className=c?'alt':'green'};
    $('#prows').appendChild(d);
  }
}
function enterGameUI(){
  $('#titleScr').classList.add('hidden');
  ['#tools','#left','#hudR','#actions','#hand'].forEach(s=>$(s).classList.remove('hidden'));
  if(NET.on)$('#btnSpd').classList.add('hidden');
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
  $('#startBtn').onclick=()=>{
    const list=[...$('#prows').children].map((r,i)=>({name:r.querySelector('input').value.trim()||DEF_NAME[i],cpu:r.querySelector('button').dataset.cpu==='1',color:PCOL[i]}));
    startGame(list);
  };
  if(AUTO){
    const n=+((location.search.match(/n=(\d)/)||[])[1]||4);
    startGame(Array.from({length:n},(_,i)=>({name:'CPU'+(i+1),cpu:true,color:PCOL[i]})));
  }
});
