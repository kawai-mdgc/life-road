// ===== ルールエンジン：マスの効果・職業能力・お金・手形・株・ゴール精算 =====
const V={};                         // 表示層（world.js / ui.js が中身を差し込む）
const SQ={};SQDATA.forEach(s=>SQ[s.id]=s);
const NUM_JOB={};JOBS.forEach(j=>NUM_JOB[j.n]=j);
const ITEM_BY_CODE={};ITEMS.forEach(i=>ITEM_BY_CODE[i.c]=i);
const COLOR_NAME={yellow:'給料日',green:'ラッキー',red:'ピンチ',blue:'イベント',gold:'STOP'};
const HEAD_COLOR={yellow:'#e6a800',green:'#2fb36f',red:'#e8454c',blue:'#3f8cff',gold:'#c98a00'};
const NOTE_LOAN=20000,NOTE_BACK=25000,PIN_MAX=6;

const G={players:[],cur:0,order:[],stockOwner:Array(11).fill(null),deckG:[],deckS:[],deckI:[],discI:[],
  houseTaken:Array(HOUSES.length).fill(false),turnNo:0,over:false,awaiting:null,logs:[]};

/* ---------- 位置・経路 ---------- */
const isStop=s=>s.c==='gold'||s.id==='W1'||s.id==='U12';   // STOPマス（就職マスW1・卒業U12も必ず止まる）
function chapterOf(key){
  const s=SQ[key]; if(s.r==='U'||s.r==='W')return 0; if(s.r==='S'||s.r==='R')return 2;
  const n=s.n; return n<=20?0:n<=50?1:n<=80?2:n<=110?3:n<=135?4:5;
}
const CHAPTER_NAME=['第1章 青春編','第2章 社会人編','第3章 家族編','第4章 中年・挑戦編','第5章 成熟編','第6章 ゴール編'];
function nextKey(p,key=p.pos){
  const s=SQ[key];
  if(s.r==='main'){
    if(s.n===150)return null;
    if(s.n===20)return p.route==='W'?'W1':'U1';
    if(s.n===80)return p.route2==='R'?'R1':'S1';
    return String(s.n+1);
  }
  const lim={U:12,W:8,S:10,R:10}[s.r];
  if(s.n<lim)return s.r+(s.n+1);
  return (s.r==='U'||s.r==='W')?'21':'81';
}
function prevKey(p,key){
  const s=SQ[key];
  if(s.r==='main'){
    if(s.n===1)return null;
    if(s.n===21)return p.route==='W'?'W8':'U12';
    if(s.n===81)return p.route2==='R'?'R10':'S10';
    return String(s.n-1);
  }
  if(s.n===1)return (s.r==='U'||s.r==='W')?'20':'80';
  return s.r+(s.n-1);
}

/* ---------- プレイヤー ---------- */
function newPlayer(id,name,cpu,color){
  return{id,name,cpu,color,pos:'1',route:null,route2:null,cash:30000,notes:0,job:null,promo:0,qual:0,items:[],houses:[],stocks:[],
    spouse:false,lover:false,kids:0,pets:0,grand:0,skip:0,again:false,bonus:0,doubleNext:false,redShield:0,retired:false,
    president:false,abroad:false,memory:false,book:false,carLevel:0,coupon:false,booster:false,halfPay:false,astroUsed:false,
    finished:false,rank:0,lastRoll:0,report:[]};
}
const active=()=>G.players.filter(q=>!q.finished);
const others=p=>G.players.filter(q=>q!==p&&!q.finished);
const jobAb=p=>p.job&&!p.retired?p.job.ab:null;
const has=(p,c)=>p.items.some(i=>i.c===c);
function takeItem(p,c){const i=p.items.findIndex(x=>x.c===c);if(i<0)return null;return p.items.splice(i,1)[0]}
function pinsOf(p){return Math.min(PIN_MAX,1+((p.spouse||p.lover)?1:0)+p.kids+p.pets+p.grand)}
function mulCount(p,x){
  switch(x){case 'others':return others(p).length;case 'kids':return p.kids;case 'grand':return p.grand;
    case 'pins':return pinsOf(p);case 'stocks':return p.stocks.length;default:return 1}
}
const salaryOf=p=>p.retired?10000:Math.round(((p.job?p.job.sal:10000)+p.promo*5000)*(p.halfPay?.5:1));
function assetsOf(p){   // 現在の総資産（見込み）
  let v=p.cash-p.notes*NOTE_BACK+p.stocks.length*10000+(p.memory?50000:0)+(p.book?15000:0);
  p.houses.forEach(h=>v+=h.sell==='roll25'?137500:h.sell);
  p.items.forEach(i=>{if(i.ty==='col')v+=i.c==='paint'?27500:i.c==='vase'?12000:i.val});
  return v;
}
function say(p,msg){V.toast(msg);V.log(msg)}

/* ---------- お金 ---------- */
async function ensureCash(p,amt){          // 足りなければ約束手形を自動発行
  while(p.cash<amt){
    p.notes++;p.cash+=NOTE_LOAN;
    say(p,`${p.name}：約束手形を発行（+${fmt(NOTE_LOAN)} LD／返済${fmt(NOTE_BACK)}）`);
    Sound.stamp();await V.noteStamp(p);V.hud();
  }
}
async function income(p,amt,o={}){          // 銀行 or 他プレイヤーからもらう
  if(amt<=0)return 0;
  if(o.celebrate&&p.booster){amt*=2;p.booster=false;say(p,'お祝いブースターで2倍！')}
  p.cash+=amt;await V.bills(o.from||'bank',p,amt,'up');V.hud();return amt;
}
async function pay(p,amt,o={}){             // 銀行 or 他プレイヤーへ払う
  if(amt<=0)return 0;
  if(o.discount!==false&&p.coupon){amt=Math.ceil(amt/2);p.coupon=false;say(p,'割引クーポンで半額！')}
  await ensureCash(p,amt);p.cash-=amt;
  if(o.to)o.to.cash+=amt;
  await V.bills(p,o.to||'bank',amt,'down');V.hud();return amt;
}
async function gifts(p,per,label){          // 全員からお祝い金（人数ぶん）
  let dbl=false;if(p.booster){dbl=true;p.booster=false;say(p,'お祝いブースターで2倍！')}
  for(const q of others(p))await pay(q,per*(dbl?2:1),{to:p,discount:false});
  V.log(`${p.name}：${label} 全員からお祝い`);
}
async function payday(p,key,passing){
  let s=salaryOf(p),note='';
  const a=jobAb(p),r=p.lastRoll;
  if(!p.retired&&p.job){
    if(a==='stream'&&(r===9||r===10)){s*=3;note='（バズって給料3倍！）'}
    if(a==='athlete'&&r===1){s=0;note='（ケガで給料0…）'}
    if(a==='farm'&&r%2===0){s+=3000;note='（偶数ボーナス+3,000）'}
  }
  if(key==='R10'&&p.president){s*=2;note='（社長マーカーで2倍）'}
  if(a==='astro'&&!p.astroUsed){p.astroUsed=true;s+=50000;note='（宇宙旅行ボーナス+50,000）'}
  if(s>0){say(p,`${passing?'給料日を通過！':'給料日！'}${p.retired?'年金':'給料'} +${fmt(s)} LD ${note}`);await income(p,s);Sound.good()}
  else say(p,`給料日… ${note}`);
}

/* ---------- 選択肢 / カード ---------- */
function ask(p,o){return V.card(Object.assign({cpu:p.cpu,pick:0},o),p)}
async function showSq(p,sq){
  const kindTxt={item:'アイテム',duel:'勝負',family:'家族',job:'職業',event:'イベント'}[sq.k]||'';
  const head=`${sq.id.match(/^\d/)?'マス '+sq.id:'ルート '+sq.id}　${COLOR_NAME[sq.c]}${kindTxt?'・'+kindTxt:''}`;
  let amt='';
  if(sq.a!==null&&sq.a!==0){amt=(sq.a>0?'+':'−')+fmt(Math.abs(sq.a))+' LD'+(sq.x?'×'+{others:'人数',kids:'子ども',grand:'孫',pins:'ピン',stocks:'株券'}[sq.x]:'')}
  else if(sq.m!=='0')amt=sq.m;
  await ask(p,{head,color:HEAD_COLOR[sq.c],title:sq.t,text:'',amt,amtCls:sq.a>0?'plus':sq.a<0?'minus':'',btns:['OK'],sq});
}
async function spin(p,purpose='duel'){
  const r=1+rnd(10);await V.roulette(p,r,purpose);return r;
}
async function duelRoll(p,win){             // ルーレット勝負（ゲームクリエイターは+1できる）
  let r=await spin(p,'duel');
  if(jobAb(p)==='gamer'&&r<10&&(!win||(!win(r)&&win(r+1)))){r++;say(p,'ゲームクリエイターの能力で出目+1！')}
  say(p,`${p.name} の出目：${r}`);return r;
}

/* ---------- アイテム ---------- */
function buildItemDeck(){G.deckI=shuffle(ITEMS.map(i=>({...i})))}
function takeItemCard(){
  if(!G.deckI.length&&G.discI.length){G.deckI=shuffle(G.discI);G.discI=[]}
  return G.deckI.shift()||null;
}
async function handleItem(p,it){
  const tyName={ins:'保険',use:'使い切り',col:'コレクション'}[it.ty];
  if(it.ty==='ins'){
    let price=it.val;if(jobAb(p)==='half_item')price=Math.ceil(price/2);
    const dup=has(p,it.c);
    const buyPick=(!dup&&p.cash>=price*3)?0:1;
    const i=await ask(p,{head:'アイテムカード（保険）',color:'#3f8cff',title:`${it.n}`,text:`${it.eff}<br>購入代金 ${fmt(price)} LD${jobAb(p)==='half_item'?'（販売員で半額）':''}${dup?'<br>※すでに持っています':''}`,btns:['買う','やめる'],pick:buyPick});
    if(i===0){await pay(p,price);p.items.push(it);say(p,`${p.name}：${it.n}を購入`)}
    else G.discI.push(it);
  }else{
    await ask(p,{head:`アイテムカード（${tyName}）`,color:it.ty==='use'?'#8e6bff':'#e6a800',title:it.n,text:`${it.eff}${it.ty==='col'?`<br>ゴールでの価値：${it.v}`:''}`,btns:['もらう']});
    p.items.push(it);say(p,`${p.name}：${it.n}を手に入れた`);
  }
  V.hud();
}
function itemWorth(it){return it.ty==='col'?(it.c==='paint'?27500:it.c==='vase'?12000:it.val):it.ty==='ins'?it.val:1500}
async function drawItem(p,count=1){
  for(let n=0;n<count;n++){
    let it;
    if(jobAb(p)==='research'){
      const a=takeItemCard(),b=takeItemCard();
      if(a&&b){
        const i=await ask(p,{head:'研究者の能力：2枚から1枚選ぶ',color:'#8e6bff',title:'どちらにする？',text:`A：${a.n}（${a.eff}）<br>B：${b.n}（${b.eff}）`,btns:['A：'+a.n,'B：'+b.n],pick:itemWorth(a)>=itemWorth(b)?0:1,col:true});
        it=i===0?a:b;G.deckI.push(i===0?b:a);
      }else it=a||b;
    }else it=takeItemCard();
    if(!it){say(p,'アイテムの山札が空です');continue}
    await handleItem(p,it);
  }
}

/* ---------- 職業 ---------- */
function buildJobDecks(){G.deckG=shuffle(JOBS.filter(j=>j.deck==='g').map(j=>({...j})));G.deckS=shuffle(JOBS.filter(j=>j.deck==='s').map(j=>({...j})))}
function drawJob(p,deck){
  const d=deck==='g'?G.deckG:G.deckS;
  for(let t=0;t<d.length;t++){const j=d.shift();
    if(j.ab==='astro'&&p.qual<1){d.push(j);continue}   // 宇宙飛行士は資格マーカーが必要
    return j}
  return null;
}
function returnJob(j){if(!j)return;(j.deck==='g'?G.deckG:G.deckS).push(j)}
function jobCardHtml(j){return `<b>${j.n}</b>（給料 ${fmt(j.sal)} LD）<br>${j.abt}`}
async function chooseJob(p,deck,count,title,mayKeep=false){
  const n=count+(p.abroad&&deck==='s'?1:0);if(p.abroad&&deck==='s'){say(p,'留学経験で1枚多く引けます')}
  const pool=[];for(let i=0;i<n;i++){const j=drawJob(p,deck);if(j)pool.push(j)}
  if(!pool.length){say(p,'職業カードの山札が空です');return}
  const val=j=>j.sal+(j.ab==='athlete'?-8000:0)+(j.ab==='stream'?4000:0);
  let best=0;pool.forEach((j,i)=>{if(val(j)>val(pool[best]))best=i});
  const btns=pool.map(j=>`${j.n}（${fmt(j.sal)}）`);
  if(mayKeep)btns.push('そのまま（転職しない）');
  const i=await ask(p,{head:title,color:'#8e6bff',title:'職業を選ぼう',text:pool.map(j=>jobCardHtml(j)).join('<hr style="border:0;border-top:1px dashed #ccc">'),btns,pick:mayKeep&&pool[best].sal<=(p.job?p.job.sal:0)?pool.length:best,col:true,jobs:pool});
  if(i>=pool.length){pool.forEach(returnJob);return}
  const chosen=pool[i];pool.forEach((j,k)=>{if(k!==i)returnJob(j)});
  returnJob(p.job);p.job=chosen;V.hud();V.pins(p);
  say(p,`${p.name} は「${chosen.n}」になった！`);Sound.good();
}

/* ---------- 赤マス（保険・特殊能力・健康／事故／詐欺） ---------- */
const INS_FOR={'8':'health','37':'health','83':'health','27':'car','43':'sec','127':'sec','67':'fire','114':'fire'};
const ABIL_VOID={'27':'void_car','43':'void_scam','127':'void_scam','67':'void_fire','114':'void_fire'};
const HEALTH_CAT=new Set(['8','37','83','98','122','140']);
const LAW_CAT=new Set(['27','43','127']);
const HOUSE_REQ=new Set(['S4','90','134','146']);
const KID_COST=new Set(['56','64','86','108','S7','115']);
const PET_SQ=new Set(['15','58','62','102']);
const TRAVEL_SQ=new Set(['46','S7','106','123']);
async function redSq(p,sq){
  let amt=Math.abs(sq.a||0)*(sq.x?mulCount(p,sq.x):1);
  if(HOUSE_REQ.has(sq.id)&&!p.houses.length){say(p,'家を持っていないので0 LD');return}
  if(amt===0){say(p,'0 LD（対象なし）');return}
  if(p.redShield>0){p.redShield--;say(p,'人間ドックの効果で無効！');Sound.good();return}
  const ins=INS_FOR[sq.id];
  if(ins&&has(p,ins)){say(p,`${ITEM_BY_CODE[ins].n}で無効！`);Sound.good();return}
  const ab=ABIL_VOID[sq.id];
  if(ab&&jobAb(p)===ab){say(p,`${p.job.n}の特殊能力で無効！`);Sound.good();return}
  if(KID_COST.has(sq.id)&&jobAb(p)==='teach'){amt=Math.ceil(amt/2);say(p,'教師の特殊能力で半額！')}
  if(sq.id==='90'&&jobAb(p)==='carp'){amt=Math.round(amt*.8);say(p,'大工の特殊能力で20%引き！')}
  Sound.bad();await pay(p,amt);
  for(const q of others(p)){     // 医者・弁護士の特殊能力（銀行から受け取る）
    if(jobAb(q)==='doc'&&HEALTH_CAT.has(sq.id)){say(q,`${q.name}（医者）が5,000 LD受け取る`);await income(q,5000)}
    if(jobAb(q)==='law'&&LAW_CAT.has(sq.id)){say(q,`${q.name}（弁護士）が5,000 LD受け取る`);await income(q,5000)}
  }
}

/* ---------- 家 ---------- */
function housePrice(p,h){let x=h.price;const a=jobAb(p);if(a==='carp'||a==='arch')x=Math.round(x*.8);return x}
async function buyHouse(p){
  const avail=HOUSES.map((h,i)=>({h,i})).filter(o=>!G.houseTaken[o.i]);
  const btns=avail.map(o=>`${o.h.n}　${fmt(housePrice(p,o.h))}`);btns.push('買わない');
  const jd=jobAb(p)==='carp'||jobAb(p)==='arch';
  // CPU：現金に余裕がある範囲で最も高い家（売却益が大きい）
  let pick=btns.length-1;
  avail.forEach((o,k)=>{const pr=housePrice(p,o.h);if(p.cash>=pr+12000&&(pick===btns.length-1||pr>housePrice(p,avail[pick].h)))pick=k});
  const i=await ask(p,{head:'マス70　家を買う',color:'#c98a00',title:'家カードから1軒選ぼう',text:`ゴールで売却額を受け取れます${jd?'<br>（特殊能力で20%引き）':''}<br><small>${avail.map(o=>`${o.h.n}：売却 ${o.h.sellt}`).join('<br>')}</small>`,btns,pick,col:true});
  if(i>=avail.length)return;
  const o=avail[i];await pay(p,housePrice(p,o.h),{discount:true});
  G.houseTaken[o.i]=true;p.houses.push(o.h);V.hud();Sound.pop();V.buildHouse(p,o.h);
  say(p,`${p.name}：${o.h.n}を購入！`);await sleep(900);
}

/* ---------- 勝負・賭け ---------- */
async function rankSpin(players,title){      // 全員で回して最大の人（同点は再勝負）
  let cand=players.slice();
  for(let round=0;round<4;round++){
    const res=[];for(const q of cand){res.push([q,await duelRoll(q)])}
    const mx=Math.max(...res.map(x=>x[1]));cand=res.filter(x=>x[1]===mx).map(x=>x[0]);
    if(cand.length===1)return cand[0];say(cand[0],'同点！ 再勝負');
  }
  return cand[0];
}
async function betSquare(p,max,winMsg){
  const opts=[0,10000,30000,50000].filter(v=>v<=max);
  const leader=G.players.every(q=>q===p||assetsOf(q)<=assetsOf(p));
  const pick=leader?1:opts.length-1;
  const i=await ask(p,{head:'賭けの勝負',color:'#3f8cff',title:'いくら賭ける？',text:`6以上で2倍、5以下で没収<br>現金 ${fmt(p.cash)} LD`,btns:opts.map(v=>v?fmt(v)+' LD':'賭けない'),pick,col:true});
  const bet=opts[i];if(!bet)return;
  const r=await duelRoll(p,x=>x>=6);
  if(r>=6){say(p,`大当たり！ +${fmt(bet)} LD`);await income(p,bet);Sound.good()}
  else{say(p,`はずれ… −${fmt(bet)} LD`);Sound.bad();await pay(p,bet,{discount:false})}
}

/* ---------- マスごとの特殊効果（青マス・STOPなど） ---------- */
const SP={};
const famBonus=async(p,id)=>{                // 家族イベントの職業能力
  const a=jobAb(p);
  if(a==='family3'){say(p,'コックの能力で+3,000');await income(p,3000)}
  if(a==='vet'&&PET_SQ.has(id)&&(p.pets>0)){say(p,'獣医の能力で+5,000');await income(p,5000)}
};
const travelBonus=async(p,id)=>{if(jobAb(p)==='travel'&&TRAVEL_SQ.has(id)){say(p,'パイロットの能力で+10,000');await income(p,10000)}};
const promote=async(p,n)=>{const k=(jobAb(p)==='promo2'&&n===1)?2:n;p.promo+=k;say(p,`昇進！ 昇進マーカー+${k}（給料+${fmt(k*5000)}）`);Sound.good();V.hud()};
SP['3']=async p=>{p.bonus=1;say(p,'次の番は出た数＋1マス進めます')};
SP['7']=async p=>{
  const q=others(p)[0];if(!q){return}
  const idx=G.players.indexOf(p);let nb=null;
  for(let k=1;k<G.players.length;k++){const c=G.players[(idx+k)%G.players.length];if(!c.finished){nb=c;break}}
  if(!nb)return;
  const a=await duelRoll(p),b=await duelRoll(nb);
  if(a>b){say(p,`${p.name}の勝ち！+3,000`);await income(p,3000)}else if(b>a){say(nb,`${nb.name}の勝ち！+3,000`);await income(nb,3000)}else say(p,'引き分け');
};
SP['9']=async p=>{const r=await duelRoll(p,x=>x%2===0);if(r%2===0){say(p,'1位！ +5,000');await income(p,5000)}else say(p,'残念、1位になれなかった')};
SP['12']=async p=>{for(const q of others(p))await pay(p,1000,{to:q,discount:false})};
SP['15']=async p=>{p.pets++;V.pins(p);say(p,'子犬をゲット！ ペットピンが車に乗った');await famBonus(p,'15')};
SP['16']=async p=>{const r=await duelRoll(p,x=>x>=8);if(r>=8){say(p,'優勝！ +10,000');await income(p,10000)}else say(p,'惜しくも入賞ならず')};
SP['19']=async p=>{p.again=true;say(p,'もう一度ルーレットを回せます！')};
SP['20']=async p=>{
  const cpuU=p.cash>=20000||Math.random()<.5;
  const i=await ask(p,{head:'マス20　進路決定',color:'#c98a00',title:'どちらの道に進む？',text:'大学ルート：学費がかかるが専門職に就ける<br>就職ルート：早く稼ぎ始める（一般職）',btns:['🎓 大学ルート','💼 就職ルート'],pick:cpuU?0:1,col:true,branch:'20'});
  p.route=i===0?'U':'W';say(p,`${p.name}は${i===0?'大学':'就職'}ルートへ`);
};
SP['26']=async p=>{const r=await duelRoll(p,x=>x===7);if(r===7){say(p,'当選！ +50,000');await income(p,50000);Sound.good()}else say(p,'はずれ')};
SP['31']=async p=>{p.lover=true;V.pins(p);say(p,'恋人ができた！ 助手席に乗った');await famBonus(p,'31')};
SP['34']=async p=>{
  const r=await spin(p,'duel');
  if(G.stockOwner[r]===null){G.stockOwner[r]=p;p.stocks.push(r);say(p,`株券「${r}」をもらった！（他人が${r}を出すと配当5,000）`);Sound.good()}
  else say(p,`株券「${r}」はすでに${G.stockOwner[r].name}が持っている`);
  V.hud();
};
SP['38']=async p=>{
  const list=active();const mn=Math.min(...list.map(q=>q.cash));const poor=list.find(q=>q.cash===mn);
  if(poor===p){say(p,'あなたが一番少ないので渡さなくてOK');return}
  await pay(p,5000,{to:poor});
};
SP['41']=async p=>{
  if(!p.job)return;
  const cpuRe=p.job.sal<24000;
  const i=await ask(p,{head:'転職フェア',color:'#3f8cff',title:'職業カードを引き直す？',text:`今の職業：${jobCardHtml(p.job)}`,btns:['引き直す','このまま'],pick:cpuRe?0:1});
  if(i===0){const old=p.job;const j=drawJob(p,old.deck);if(j){returnJob(old);p.job=j;say(p,`転職！「${j.n}」になった`);V.hud();V.pins(p)}}
};
SP['44']=async p=>{const r=await duelRoll(p,x=>x>=6);if(r>=6){say(p,'完走！ +8,000');await income(p,8000)}else say(p,'リタイア…')};
SP['46']=async p=>{p.doubleNext=true;say(p,'次の番はルーレットを2回回して合計進みます');await travelBonus(p,'46')};
SP['29']=async p=>promote(p,1);
SP['68']=async p=>promote(p,1);
SP['91']=async p=>{p.promo+=2;say(p,'管理職に昇進！ 昇進マーカー+2（給料+10,000）');Sound.good();V.hud()};
SP['21']=async p=>{await payday(p,'21',false)};
SP['51']=async p=>{
  const had=p.lover;p.spouse=true;p.lover=false;V.pins(p);Sound.good();
  say(p,'結婚！ パートナーのピンが車に乗った');
  await gifts(p,5000,'結婚');
  if(had){say(p,'恋人からの祝い金+10,000');await income(p,10000,{celebrate:true})}
  if(jobAb(p)==='wed5'){say(p,'美容師の能力で+5,000');await income(p,5000)}
  V.confetti(p.pos);
};
const baby=async(p,n,id)=>{
  p.kids+=n;V.pins(p);Sound.good();say(p,n===2?'双子が誕生！ ピンが2本追加':'子ども誕生！ ピンが追加');
  await gifts(p,2000,'出産');
  if(jobAb(p)==='baby3'){say(p,'保育士の能力で+3,000');await income(p,3000)}
  await famBonus(p,id);V.confetti(p.pos);
};
SP['54']=async p=>baby(p,1,'54');
SP['61']=async p=>baby(p,2,'61');
SP['73']=async p=>baby(p,1,'73');
SP['58']=async p=>{
  if(p.pets>0){say(p,'ペットがいるので+3,000');await income(p,3000)}
  if(jobAb(p)==='vet'&&p.pets>0){say(p,'獣医の能力で+5,000');await income(p,5000)}
};
SP['62']=async p=>{
  if(!p.pets){say(p,'ペットがいないので参加できない');return}
  const r=await duelRoll(p,x=>x>=5);if(r>=5){say(p,'優勝！ +10,000');await income(p,10000)}else say(p,'残念…');
  if(jobAb(p)==='vet'){say(p,'獣医の能力で+5,000');await income(p,5000)}
};
SP['70']=async p=>buyHouse(p);
SP['72']=async p=>{await gifts(p,3000,'新居祝い')};
SP['77']=async p=>{const r=await duelRoll(p,x=>x===1);if(r===1){say(p,'大当たり！ +30,000');await income(p,30000);Sound.good()}else say(p,'はずれ')};
SP['80']=async p=>{
  const lead=G.players.every(q=>q===p||assetsOf(q)<=assetsOf(p));
  const i=await ask(p,{head:'マス80　生き方の分岐',color:'#c98a00',title:'どちらの生き方を選ぶ？',text:'安定ルート：リスク小、手堅い収入<br>挑戦ルート：起業・投資。大当たりか大損',btns:['🏠 安定ルート','🚀 挑戦ルート'],pick:lead?0:(Math.random()<.5?1:0),col:true,branch:'80'});
  p.route2=i===0?'S':'R';say(p,`${p.name}は${i===0?'安定':'挑戦'}ルートへ`);
};
SP['81']=async p=>{say(p,'人生の後半戦スタート！')};
SP['87']=async p=>{p.skip=1;say(p,'町内会長に選ばれた。次は1回休み');await income(p,10000)};
SP['89']=async p=>{
  const list=active();if(list.length<2)return;
  const w=await rankSpin(list);say(w,`${w.name}がゴルフコンペで優勝！`);
  for(const q of list)if(q!==w)await pay(q,3000,{to:w,discount:false});
};
SP['94']=async p=>{await pay(p,20000);p.carLevel++;V.upgradeCar(p);say(p,'車が1ランクアップ！')};
SP['96']=async p=>{p.redShield++;say(p,'次に止まる赤マスを1回無効にします')};
SP['100']=async p=>{const list=active();const w=await rankSpin(list);say(w,`${w.name}が折り返し記念で+20,000`);await income(w,20000)};
SP['102']=async p=>{p.pets++;V.pins(p);say(p,'ペットに赤ちゃん！ ペットピンが増えた');await famBonus(p,'102')};
SP['106']=async p=>{
  await travelBonus(p,'106');
  const r=await duelRoll(p,x=>x%2===1);
  if(r%2===1){say(p,'勝ち！ +20,000');await income(p,20000)}else{say(p,'負け… −20,000');await pay(p,20000,{discount:false})}
};
SP['110']=async p=>{
  const cpuYes=salaryOf(p)*.5*7<50000;
  const i=await ask(p,{head:'早期退職の誘い',color:'#3f8cff',title:'早期退職を受ける？',text:'受けると +50,000 LD。ただし以降の給料は半分になります',btns:['受ける','受けない'],pick:cpuYes?0:1});
  if(i===0){p.halfPay=true;await income(p,50000);say(p,'早期退職を受けた（以降の給料は半分）')}
};
SP['117']=async p=>{p.grand++;V.pins(p);await income(p,5000);say(p,'孫が誕生！ 孫ピンが増えた');await famBonus(p,'117')};
SP['129']=async p=>{p.grand++;V.pins(p);await income(p,5000);say(p,'孫が誕生！ 孫ピンが増えた');await famBonus(p,'129')};
SP['115']=async p=>{
  if(!p.kids){say(p,'子どもがいないので0 LD');return}
  let a=10000;if(jobAb(p)==='teach'){a=5000;say(p,'教師の能力で半額')}await pay(p,a);
};
SP['108']=async p=>{if(!p.kids){say(p,'子どもがいないので0 LD');return}await redSq(p,SQ['108'])};
SP['119']=async p=>{const r=await duelRoll(p);say(p,`出た数 ${r} × 3,000`);await income(p,r*3000)};
SP['123']=async p=>{
  const go=p.cash>=60000;
  const i=await ask(p,{head:'世界一周旅行',color:'#3f8cff',title:'世界一周に行く？',text:'行くなら −30,000 LD。ゴール時に思い出ボーナス +50,000 LD',btns:['行く','行かない'],pick:go?0:1});
  if(i===0){await pay(p,30000);p.memory=true;say(p,'世界一周へ出発！');await travelBonus(p,'123')}
};
SP['128']=async p=>{if(p.job&&!p.retired){say(p,'講演料：給料1回分');await income(p,salaryOf(p))}else say(p,'給料がないので0')};
SP['132']=async p=>{const r=await duelRoll(p,x=>x===10);if(r===10){say(p,'1等！ +100,000');await income(p,100000);Sound.fanfare()}else say(p,'はずれ')};
SP['136']=async p=>{
  const s=salaryOf(p)*3;say(p,`退職！ 退職金 ${fmt(s)} LD`);await income(p,s);
  returnJob(p.job);p.job=null;p.promo=0;p.halfPay=false;p.retired=true;V.hud();V.pins(p);
};
SP['139']=async p=>{await pay(p,5000);p.book=true;say(p,'自分史を出版！ ゴールで+15,000')};
SP['141']=async p=>{await income(p,10000)};
SP['147']=async p=>{await income(p,10000)};
SP['145']=async p=>{await betSquare(p,50000)};
SP['149']=async p=>{const n=pinsOf(p);say(p,`車に乗っているピン${n}本 × 3,000`);await income(p,3000*n)};
SP['150']=async p=>{await goalSettle(p)};
SP['U1']=async p=>{await pay(p,20000)};
SP['U5']=async p=>{await travelBonus(p,'U5');const r=await duelRoll(p,x=>x<=3);if(r<=3){p.abroad=true;say(p,'留学決定！ 職業選択で1枚多く引ける')}else say(p,'留学は見送り')};
SP['U6']=async p=>{const r=await duelRoll(p,x=>x>=5);if(r<=4){p.skip=1;say(p,'再試験で1回休み')}else say(p,'合格！')};
SP['U8']=async p=>{p.qual++;say(p,'資格マーカーを1つ獲得！（宇宙飛行士に必要）');V.hud()};
SP['U12']=async p=>{await chooseJob(p,'s',3,'卒業！ 専門職の山から3枚引いて1枚選ぶ')};
SP['W1']=async p=>{await chooseJob(p,'g',2,'就職！ 一般職の山から2枚引いて1枚選ぶ')};
SP['W8']=async p=>{
  const r=await duelRoll(p,x=>x>=7);
  if(r>=7)await chooseJob(p,'s',1,'夜間学校：専門職に転職できる',true);else say(p,'試験に落ちた…');
};
SP['R1']=async p=>{await pay(p,30000);p.president=true;say(p,'起業！ 社長マーカーを獲得');V.hud()};
SP['R2']=async p=>{const r=await duelRoll(p);say(p,`新商品 出た数 ${r} × 5,000`);await income(p,r*5000)};
SP['R4']=async p=>{await drawItem(p,2)};
SP['R5']=async p=>{await betSquare(p,50000)};
SP['R8']=async p=>{const r=await duelRoll(p,x=>x>=9);if(r>=9){say(p,'上場成功！ +100,000');await income(p,100000);Sound.fanfare()}else say(p,'上場ならず')};
SP['R10']=async p=>{await payday(p,'R10',false)};
SP['S7']=async p=>{await travelBonus(p,'S7');let a=2000*p.kids;if(jobAb(p)==='teach')a=Math.ceil(a/2);if(a>0)await pay(p,a);else say(p,'子どもがいないので0 LD')};
SP['109']=async p=>{let a=25000;if(jobAb(p)==='patent'){a*=2;say(p,'エンジニアの能力で2倍！')}await income(p,a)};
SP['57']=async p=>{await income(p,5000,{celebrate:true})};

async function landEffect(p,sq){
  if(SP[sq.id])return SP[sq.id](p,sq);
  switch(sq.c){
    case 'yellow':return payday(p,sq.id,false);
    case 'green':{
      const a=sq.a*(sq.x?mulCount(p,sq.x):1);
      if(a>0){Sound.good();return income(p,a)}return;
    }
    case 'red':return redSq(p,sq);
    case 'blue':if(sq.k==='item')return drawItem(p,1);return;
  }
}
async function land(p){
  const sq=SQ[p.pos];
  V.flash(p.pos);Sound.stopSq();
  V.bubble(p.pos,sq.t);
  await showSq(p,sq);
  V.bubbleOff();
  if(sq.id!=='1')await landEffect(p,sq);
  await sleep(250);
}

/* ---------- ゴール精算 ---------- */
async function goalSettle(p){
  p.finished=true;G.order.push(p);p.rank=G.order.length;
  const rep=p.report;rep.push(['ゴール時の現金',p.cash]);
  let total=0;const add=(label,v)=>{rep.push([label,v]);total+=v};
  // 家の売却
  for(const h of p.houses){
    let v;if(h.sell==='roll25'){const r=await spin(p,'duel');v=r*25000;say(p,`${h.n}：出た数${r}×25,000`)}else v=h.sell;
    add(`${h.n}を売却`,v);
  }
  // アイテムの換金
  for(const it of p.items.filter(i=>i.ty==='col')){
    let v=it.val;
    if(it.c==='paint'){const r=await spin(p,'duel');v=r*5000;say(p,`名画：出た数${r}×5,000`)}
    if(it.c==='vase'){const r=await spin(p,'duel');v=r===1?0:15000;say(p,`古いつぼ：出た数${r}`)}
    add(`${it.n}を換金`,v);
  }
  if(p.stocks.length)add(`株券${p.stocks.length}枚を買い取り`,p.stocks.length*10000);
  if(p.memory)add('世界一周の思い出ボーナス',50000);
  if(p.book)add('自分史の出版ボーナス',15000);
  if(p.notes)add(`約束手形${p.notes}枚を返済`,-p.notes*NOTE_BACK);
  const bonus=[50000,30000,20000][p.rank-1]||10000;
  add(`到着順ボーナス（${p.rank}位）`,bonus);
  p.cash+=total;p.final=p.cash;p.notes=0;p.houses=[];p.stocks=[];p.items=[];
  V.hud();Sound.fanfare();V.confetti(p.pos);V.finishCar(p);
  const rows=rep.map(r=>`<tr><td>${r[0]}</td><td class="${r[1]<0?'minus':''}">${fmt(r[1])}</td></tr>`).join('');
  await ask(p,{head:`🏁 ゴール！ ${p.rank}着`,color:'#c98a00',title:`${p.name} の最終決算`,text:`<table class="tbl">${rows}<tr><th>総資産</th><th>${fmt(p.final)} LD</th></tr></table>`,btns:['OK'],pick:0});
}

/* ---------- 移動・ターン ---------- */
async function moveSteps(p,n){
  for(let i=0;i<n;i++){
    const nk=nextKey(p);if(!nk)break;
    p.pos=nk;await V.step(p,nk);
    const s=SQ[nk];
    if(isStop(s))break;                                   // STOPマスは通過できない
    if(i<n-1&&s.c==='yellow')await payday(p,nk,true);      // 給料日は通過でももらえる
  }
  V.chapter(chapterOf(p.pos),p);
}
function scoreLanding(p,r){                                  // CPU用：r進んだ先の良し悪し
  let key=p.pos,sc=0;
  for(let i=0;i<r;i++){
    const nk=nextKey({...p,pos:key,route:p.route||'U',route2:p.route2||'S'},key);if(!nk)break;key=nk;const s=SQ[nk];
    if(isStop(s))break;
    if(i<r-1&&s.c==='yellow')sc+=1.5;
  }
  const s=SQ[key];sc+=({yellow:2,green:2,red:-2.2,blue:.2,gold:1})[s.c];
  if(s.c==='red'&&(p.redShield||INS_FOR[s.id]&&has(p,INS_FOR[s.id])))sc+=2.2;
  return sc;
}
async function modifyRoll(p,r){          // ターボチケット / ラッキーコイン
  const turbo=has(p,'turbo'),coin=has(p,'coin');
  if(!turbo&&!coin)return r;
  const opts=[{t:`このまま ${r} 進む`,v:r}];
  if(coin&&r<10)opts.push({t:`🪙 ラッキーコイン：${r+1} にする`,v:r+1,coin:1});
  if(coin&&r>1)opts.push({t:`🪙 ラッキーコイン：${r-1} にする`,v:r-1,coin:1});
  if(turbo)opts.push({t:'🎟 ターボチケット：回し直す',turbo:1});
  let pick=0;
  if(p.cpu){
    let best=scoreLanding(p,r),bi=0;
    opts.forEach((o,i)=>{if(o.v&&scoreLanding(p,o.v)>best+1.9){best=scoreLanding(p,o.v);bi=i}});
    if(bi===0&&turbo&&scoreLanding(p,r)<0)bi=opts.findIndex(o=>o.turbo);
    pick=bi;
  }
  const i=await ask(p,{head:'アイテムを使う？',color:'#8e6bff',title:`出目は ${r}`,text:'出目を変えたり、回し直したりできます',btns:opts.map(o=>o.t),pick,col:true});
  const o=opts[i];
  if(o.turbo){takeItem(p,'turbo');say(p,'ターボチケット！ もう一度回す');V.hud();const r2=await spin(p,'move');return r2}
  if(o.coin){takeItem(p,'coin');say(p,`ラッキーコイン！ 出目が ${o.v} に`);V.hud();return o.v}
  return r;
}
async function dividends(p,r){
  const q=G.stockOwner[r];
  if(q&&q!==p&&!q.finished){say(q,`${q.name}の株券「${r}」の配当 +5,000`);await income(q,5000)}
}

/* ---------- アイテム使用（自分の番・ルーレット前） ---------- */
function usableItems(p){
  const L=[];
  if(has(p,'back')&&others(p).length)L.push('back');
  if(has(p,'swap')&&others(p).some(q=>q.job)&&p.job)L.push('swap');
  if(has(p,'map'))L.push('map');
  if(has(p,'key')&&p.notes>0&&p.cash>=NOTE_LOAN)L.push('key');
  if(has(p,'coupon')&&!p.coupon)L.push('coupon');
  if(has(p,'boost')&&!p.booster)L.push('boost');
  return L;
}
async function backward(q,n){
  for(let i=0;i<n;i++){
    const pk=prevKey(q,q.pos);if(!pk)break;
    q.pos=pk;await V.step(q,pk);
    if(SQ[pk].c==='gold')break;                 // STOPマスは越えない
  }
}
async function useItem(p,c){
  const it=ITEM_BY_CODE[c];
  if(c==='back'){
    const L=others(p);
    const lead=L.reduce((a,b)=>assetsOf(b)>assetsOf(a)?b:a,L[0]);
    const i=await ask(p,{head:'バックギア',color:'#8e6bff',title:'誰を3マス戻す？',text:'STOPマスは越えません',btns:L.map(q=>q.name),pick:L.indexOf(lead),col:true});
    takeItem(p,'back');const t=L[i];say(p,`${t.name}を3マス戻した！`);await backward(t,3);
  }else if(c==='swap'){
    const L=others(p).filter(q=>q.job);
    const best=L.reduce((a,b)=>b.job.sal>a.job.sal?b:a,L[0]);
    const i=await ask(p,{head:'職業交換チケット',color:'#8e6bff',title:'誰と職業を交換する？',text:`あなたの職業：${p.job.n}`,btns:L.map(q=>`${q.name}（${q.job.n}）`),pick:L.indexOf(best),col:true});
    takeItem(p,'swap');const t=L[i];[p.job,t.job]=[t.job,p.job];say(p,`${p.name}と${t.name}が職業を交換！`);V.hud();V.pins(p);V.pins(t);
  }else if(c==='map'){
    takeItem(p,'map');const r=await spin(p,'duel');
    if(r===10){say(p,'宝を発見！ +50,000');await income(p,50000);Sound.fanfare()}else say(p,`出た数${r}… 宝は見つからなかった`);
  }else if(c==='key'){
    takeItem(p,'key');p.notes--;p.cash-=NOTE_LOAN;say(p,'金庫カギで手形1枚を利息なしで返済！');Sound.stamp();V.hud();
  }else if(c==='coupon'){takeItem(p,'coupon');p.coupon=true;say(p,'次の支払いが半額になります')}
  else if(c==='boost'){takeItem(p,'boost');p.booster=true;say(p,'次にもらうお祝い金が2倍になります')}
  V.hud();
}
async function cpuItems(p){
  const L=usableItems(p);
  for(const c of L){
    if(c==='map'||c==='key'||c==='coupon')await useItem(p,c);
    if(c==='boost'&&['46','47','48','49','50','51','52','53','54','55','60','65','70','71'].includes(p.pos))await useItem(p,c);
    if(c==='swap'&&p.job){const L2=others(p).filter(q=>q.job&&q.job.sal>p.job.sal+8000);if(L2.length)await useItem(p,c)}
    if(c==='back'){
      const lead=others(p).reduce((a,b)=>assetsOf(b)>assetsOf(a)?b:a);
      if(assetsOf(lead)>assetsOf(p)+20000)await useItem(p,c);
    }
  }
}

/* ---------- 1ターン ---------- */
async function takeTurn(p){
  V.focus(p);V.hud();
  if(p.skip>0){
    if(has(p,'nap')){
      const i=await ask(p,{head:'1回休み',color:'#e8454c',title:'おやすみ免除券を使う？',text:'使うと休まずに進めます',btns:['使う','休む'],pick:0});
      if(i===0){takeItem(p,'nap');p.skip=0;say(p,'おやすみ免除券を使った！');V.hud()}
    }
    if(p.skip>0){p.skip--;say(p,`${p.name}は1回休み`);await sleep(700);return}
  }
  let guard=0;
  do{
    p.again=false;
    if(p.cpu)await cpuItems(p);
    G.awaiting=p;V.hud();
    let steps;
    if(p.doubleNext){
      p.doubleNext=false;const a=await spin(p,'move'),b=await spin(p,'move');
      p.lastRoll=b;await dividends(p,a);await dividends(p,b);
      steps=a+b;say(p,`海外出張：${a}＋${b}＝${steps}マス進む`);G.awaiting=null;
    }else{
      let r=await spin(p,'move');G.awaiting=null;
      await dividends(p,r);
      r=await modifyRoll(p,r);p.lastRoll=r;steps=r;
      say(p,`${p.name}：${r} が出た！`);
    }
    if(p.bonus){steps+=p.bonus;say(p,`自転車ボーナス+${p.bonus}`);p.bonus=0}
    await moveSteps(p,steps);
    await land(p);
    V.hud();
  }while(p.again&&!p.finished&&++guard<5);
}

function setupGame(list){
  G.players=list.map((o,i)=>newPlayer(i,o.name,o.cpu,o.color));
  G.cur=0;G.order=[];G.over=false;G.turnNo=0;
  G.stockOwner=Array(11).fill(null);G.houseTaken=Array(HOUSES.length).fill(false);
  buildItemDeck();buildJobDecks();
}
async function playGame(){
  while(active().length&&!G.over){
    const p=G.players[G.cur];
    if(!p.finished){G.turnNo++;await takeTurn(p)}
    G.cur=(G.cur+1)%G.players.length;
    if(G.turnNo>2500){break}      // 念のための安全弁
  }
  await V.results();
}
