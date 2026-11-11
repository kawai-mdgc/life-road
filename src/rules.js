// ===== ルールエンジン：マスの効果・職業能力・お金・手形・株・ゴール精算 =====
const V={};                         // 表示層（world.js / ui.js が中身を差し込む）
const SQ={};SQDATA.forEach(s=>{s.t=yen(s.t);s.m=yen(s.m);SQ[s.id]=s});
SQ['15'].t='ペットをむかえる。犬か猫を選べる（ペットピンが車に乗る）';SQ['102'].t='ペットに赤ちゃんが生まれる。犬か猫を選んでペットピン追加';
JOBS.forEach(j=>j.abt=yen(j.abt));ITEMS.forEach(i=>{i.eff=yen(i.eff);i.v=yen(i.v)});HOUSES.forEach(h=>h.sellt=yen(h.sellt));   // 通貨は円
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

/* ---------- 年齢（盤上の位置から決める） ---------- */
const AGE20=[0,3,5,6,7,8,9,10,10,11,12,13,14,15,15,16,18,18,18,18];   // マス1〜20の年齢（17=18歳で免許）
const AGE_A=[[1,0],[20,18],[21,22],[50,30],[80,42],[81,45],[110,55],[135,64],[136,65],[150,100]];   // ゴールは100歳
function ageOfKey(key){
  const s=SQ[key];let n;
  if(s.r==='main'&&s.n<=20)return AGE20[s.n-1];
  if(s.r==='main')n=s.n;
  else{const lim={U:12,W:8,S:10,R:10}[s.r],a=(s.r==='U'||s.r==='W')?20:80;n=a+s.n/(lim+1)}
  for(let i=1;i<AGE_A.length;i++){
    if(n<=AGE_A[i][0]){const[a0,g0]=AGE_A[i-1],[a1,g1]=AGE_A[i];return Math.floor(g0+(g1-g0)*(n-a0)/(a1-a0))}
  }
  return 100;
}

/* ---------- 幸福度と履歴（最後にグラフで見られる） ---------- */
function happinessOf(p){
  let h=40;
  h+=p.spouse?14:p.lover?6:0;
  h+=Math.min(15,p.kids*6)+Math.min(6,p.pets*3)+Math.min(4,p.grand*2);
  h+=p.houses.length?8:0;
  h+=p.job&&!p.retired?3:0;
  if(p.affairInfo)h-=6;
  if(p.jobless>0)h-=10;
  if(p.spouseJobless>0)h-=4;
  if(p.inJail)h-=12;
  h-=Math.min(12,p.notes*4);
  h+=Math.min(18,Math.round(Math.log10(1+Math.max(0,assetsOf(p))/10000)*6));   // お金は多いほど少し幸せ（頭打ち）
  return clamp(Math.round(h),0,100);
}
function recordHist(p){
  if(!G.hist)G.hist={};
  (G.hist[p.id]||(G.hist[p.id]=[])).push({a:ageOfKey(p.pos),w:assetsOf(p),h:happinessOf(p)});
}

/* ---------- 乗り物：ベビーカー → 自転車 → 車（免許）→ 車椅子（免許返納） ---------- */
const VORDER={stroller:0,bike:1,car:2,chair:3,echair:3,scooter:3};
const OLD_LIMITS=[1200000,1700000];            // 80歳時点の総資産：未満→手動車椅子／未満→電動車椅子／それ以上→シニアカー
const oldVehicleOf=p=>{const a=assetsOf(p);return a<OLD_LIMITS[0]?'chair':a<OLD_LIMITS[1]?'echair':'scooter'};
const vehicleOfAge=(a,p)=>a<5?'stroller':a<18?'bike':a<80?'car':(p.oldVeh||'chair');
const VEH_MSG={bike:['🚲 自転車デビュー！','ベビーカーを卒業して、自転車に乗れるように！'],car:['🚗 免許を取って車に！','18歳！ 免許を取って、車に乗りかえ！'],
  chair:['🧓 免許返納… 手動車椅子に','老年期に突入。免許を返納して、手動車椅子に（収入が多くなかったので）'],
  echair:['🧓 免許返納… 電動車椅子に','老年期に突入。免許を返納して、電動車椅子に（まずまずの収入）'],
  scooter:['🧓 免許返納… シニアカーに！','老年期に突入。免許を返納して、シニアカーに（ゆとりのある老後）']};
async function checkVehicle(p){
  const age=ageOfKey(p.pos);
  if(age>=80&&!p.oldVeh)p.oldVeh=oldVehicleOf(p);          // 80歳になった時点の収入で決まる
  const v=vehicleOfAge(age,p);
  if(v===p.vstage)return;
  const up=VORDER[v]>VORDER[p.vstage];p.vstage=v;
  if(up&&VEH_MSG[v]){V.banner(VEH_MSG[v][0]);say(p,`${p.name}：${VEH_MSG[v][1]}`);Sound.good();await sleep(900)}
  V.pins(p);
}

/* ---------- プレイヤー ---------- */
function newPlayer(id,name,cpu,color,cloth,gender){
  return{id,name,cpu,color,cloth:cloth??color,gender:gender||'n',pos:'1',route:null,route2:null,cash:30000,notes:0,job:null,promo:0,qual:0,items:[],houses:[],stocks:[],
    spouse:false,lover:false,kids:0,pets:0,grand:0,skip:0,again:false,bonus:0,doubleNext:false,redShield:0,retired:false,
    president:false,abroad:false,memory:false,book:false,carLevel:0,coupon:false,booster:false,halfPay:false,astroUsed:false,
    finished:false,rank:0,lastRoll:0,report:[],spouseInfo:null,petList:[],loverInfo:null,affairInfo:null,kidList:[],jobless:0,spouseJobless:0,vstage:'stroller',oldVeh:null,inJail:false,bonusTotal:0,chased:false};
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
const CHASE_ON=3,CHASE_OFF=2;                          // 手形が3枚以上で取り立て屋が来て、2枚以下に返済すると引き上げる
async function checkChase(p){
  if(p.finished){if(p.chased){p.chased=false;await V.thugsLeave(p)}return}
  if(!p.chased&&p.notes>=CHASE_ON){
    p.chased=true;V.banner('🕶 取り立て屋が現れた！');
    say(p,`${p.name}：約束手形が${p.notes}枚… 黒い車の取り立て屋が付きまといます（${CHASE_OFF}枚以下に返済するまで）`);
    await V.thugsArrive(p);
  }else if(p.chased&&p.notes<=CHASE_OFF){
    p.chased=false;say(p,`${p.name}：手形を返して、取り立て屋は引き上げていった`);
    await V.thugsLeave(p);
  }
}
async function ensureCash(p,amt){          // 足りなければ約束手形を自動発行
  while(p.cash<amt){
    p.notes++;p.cash+=NOTE_LOAN;
    say(p,`${p.name}：約束手形を発行（+${fmt(NOTE_LOAN)}円／返済${fmt(NOTE_BACK)}）`);
    Sound.stamp();await V.noteStamp(p);V.hud();
    await checkChase(p);
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
  if(p.jobless>0&&!p.retired){p.jobless--;s=Math.round(s*.3);note+='（失業中：失業手当は30%）'}
  if(p.spouseInfo&&!p.retired&&p.spouseInfo.bonus){
    if(p.spouseJobless>0){p.spouseJobless--;note+=`（${p.spouseInfo.name}さんが失業中で共働きなし）`}
    else{s+=p.spouseInfo.bonus;note+=`（${p.spouseInfo.name}さんの共働き+${fmt(p.spouseInfo.bonus)}円）`}
  }
  if(a==='astro'&&!p.astroUsed){p.astroUsed=true;s+=50000;note='（宇宙旅行ボーナス+50,000）'}
  if(s>0){say(p,`${passing?'給料日を通過！':'給料日！'}${p.retired?'年金':'給料'} +${fmt(s)}円 ${note}`);await income(p,s);Sound.good()}
  else say(p,`給料日… ${note}`);
  if(p.affairInfo){say(p,`愛人（${p.affairInfo.name}）への出費 −3,000円`);await pay(p,3000,{discount:false})}
}

async function repayNotes(p,n){            // 財布から、いつでも約束手形を返済（1枚25,000円）
  n=Math.min(n,p.notes,Math.floor(p.cash/NOTE_BACK));
  if(n<=0||p.finished)return false;
  p.notes-=n;p.cash-=n*NOTE_BACK;
  say(p,`${p.name}：約束手形を${n}枚 返済（${fmt(n*NOTE_BACK)}円）`);Sound.stamp();
  await V.bills(p,'bank',n*NOTE_BACK);V.hud();await checkChase(p);return true;
}

/* ---------- 選択肢 / カード ---------- */
function ask(p,o){return V.card(Object.assign({cpu:p.cpu,pick:0},o),p)}
async function showSq(p,sq,note=''){
  const kindTxt={item:'アイテム',duel:'勝負',family:'家族',job:'職業',event:'イベント'}[sq.k]||'';
  const head=`${sq.id.match(/^\d/)?'マス '+sq.id:'ルート '+sq.id}（${ageOfKey(sq.id)}歳）　${COLOR_NAME[sq.c]}${kindTxt?'・'+kindTxt:''}`;
  let amt='';
  if(sq.a!==null&&sq.a!==0){amt=(sq.a>0?'+':'−')+fmt(Math.abs(sq.a))+'円'+(sq.x?'×'+{others:'人数',kids:'子ども',grand:'孫',pins:'ピン',stocks:'株券'}[sq.x]:'')}
  else if(sq.m!=='0')amt=sq.m;
  if(note)amt='';
  await ask(p,{head,color:HEAD_COLOR[sq.c],title:sq.t,text:note?`<small>（${note}）</small>`:'',amt,amtCls:sq.a>0?'plus':sq.a<0?'minus':'',btns:['OK'],sq});
}
async function spin(p,purpose='duel'){return V.roulette(p,purpose)}   // 回す→止める（結果は止めた瞬間に決まる）
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
    const i=await ask(p,{head:'アイテムカード（保険）',color:'#3f8cff',title:`${it.n}`,text:`${it.eff}<br>購入代金 ${fmt(price)}円${jobAb(p)==='half_item'?'（販売員で半額）':''}${dup?'<br>※すでに持っています':''}`,btns:['買う','やめる'],pick:buyPick});
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
function jobCardHtml(j){return `<b>${j.n}</b>（給料 ${fmt(j.sal)}円）<br>${j.abt}`}
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
  if(HOUSE_REQ.has(sq.id)&&!p.houses.length){say(p,'家を持っていないので0円');return}
  if(amt===0){say(p,'0円（対象なし）');return}
  if(p.redShield>0){p.redShield--;say(p,'人間ドックの効果で無効！');Sound.good();return}
  const ins=INS_FOR[sq.id];
  if(ins&&has(p,ins)){say(p,`${ITEM_BY_CODE[ins].n}で無効！`);Sound.good();return}
  const ab=ABIL_VOID[sq.id];
  if(ab&&jobAb(p)===ab){say(p,`${p.job.n}の特殊能力で無効！`);Sound.good();return}
  if(KID_COST.has(sq.id)&&jobAb(p)==='teach'){amt=Math.ceil(amt/2);say(p,'教師の特殊能力で半額！')}
  if(sq.id==='90'&&jobAb(p)==='carp'){amt=Math.round(amt*.8);say(p,'大工の特殊能力で20%引き！')}
  Sound.bad();await pay(p,amt);
  for(const q of others(p)){     // 医者・弁護士の特殊能力（銀行から受け取る）
    if(jobAb(q)==='doc'&&HEALTH_CAT.has(sq.id)){say(q,`${q.name}（医者）が5,000円受け取る`);await income(q,5000)}
    if(jobAb(q)==='law'&&LAW_CAT.has(sq.id)){say(q,`${q.name}（弁護士）が5,000円受け取る`);await income(q,5000)}
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
  const i=await ask(p,{head:'賭けの勝負',color:'#3f8cff',title:'いくら賭ける？',text:`6以上で2倍、5以下で没収<br>現金 ${fmt(p.cash)}円`,btns:opts.map(v=>v?fmt(v)+'円':'賭けない'),pick,col:true});
  const bet=opts[i];if(!bet)return;
  const r=await duelRoll(p,x=>x>=6);
  if(r>=6){say(p,`大当たり！ +${fmt(bet)}円`);await income(p,bet);Sound.good()}
  else{say(p,`はずれ… −${fmt(bet)}円`);Sound.bad();await pay(p,bet,{discount:false})}
}

/* ---------- マスごとの特殊効果（青マス・STOPなど） ---------- */
/* ---------- 結婚相手・ペットのプロフィールカード ---------- */
const pickOf=a=>a[rnd(a.length)];
const GN={m:'男性',f:'女性',n:'どちらでも'};
const SP_NAMES={m:['ハルト','ソウタ','レン','ユウキ','タクミ','カイト','リョウ','ダイスケ'],f:['ミサキ','ユイ','サクラ','アヤカ','ナナ','ヒナタ','リコ','マイ'],n:['アキ','ユウ','ミナト','ハル','ソラ','リン']};
const SP_JOBS=['看護師','パン職人','デザイナー','保育士','会社員','先生','農家','カメラマン','消防士','薬剤師','公務員','美容師','エンジニア','パティシエ'];
const SP_HOBBY=['料理','キャンプ','映画','ゲーム','ガーデニング','ランニング','読書','旅行','カフェ巡り','釣り'];
const SP_TRAIT=['やさしい','しっかり者','おもしろい','マイペース','努力家','ロマンチスト','しずか','明るい'];
const stars=n=>'★'.repeat(n)+'☆'.repeat(3-n);
function genPerson(g,p,role='spouse'){
  const inc=1+rnd(3),base=ageOfKey(p.pos);
  return{gender:g,name:pickOf(SP_NAMES[g]),age:clamp(base+rnd(9)-4,18,90),job:pickOf(SP_JOBS),hobby:pickOf(SP_HOBBY),trait:pickOf(SP_TRAIT),
    inc,hk:1+rnd(3),lv:1+rnd(3),cloth:CLOTH_COLS[rnd(CLOTH_COLS.length)],role,bonus:role==='spouse'?[0,1000,3000,5000][inc]:0};
}
const genSpouse=(g,p)=>genPerson(g,p,'spouse');
function spouseHtml(c,tag=''){
  const line=c.role==='affair'?'<small class="minus">愛人：給料日ごとに−3,000円</small>':c.role==='lover'&&!tag?'<small>恋人</small>':`<small class="plus">共働き：給料日ごとに+${fmt([0,1000,3000,5000][c.inc])}円</small>`;
  return `<img class="pimg" src="${portraitBust(c)}" alt=""><div class="pi">${tag?`<span class="ptag">${tag}</span> `:''}<b>${esc(c.name)}</b> ${c.age}歳・${GN[c.gender]}<br>💼${esc(c.job)} 🎯${esc(c.hobby)}<br>💬${esc(c.trait)}<br><span class="stars">収入${stars(c.inc)} 家事${stars(c.hk)} 愛情${stars(c.lv)}</span><br>${line}</div>`;
}
// 性別 → 3人のプロフィールカードから選ぶ（include=すでにいる人を候補に入れる／gender固定も可）
async function choosePerson(p,o){
  let g=o.gender;
  if(!g){
    const gi=await ask(p,{head:o.head,color:o.color,title:o.q,text:'まず、相手の性別を選んでください',btns:['👨 男性','👩 女性','🧑 どちらでもない'],pick:rnd(3),col:true});
    g=['m','f','n'][gi];
  }
  const cand=[];if(o.include)cand.push(o.include);
  while(cand.length<3)cand.push(genPerson(g,p,o.role));
  let best=o.include?0:rnd(3);if(o.role==='spouse'&&!o.include){best=0;cand.forEach((c,i)=>{if(c.bonus>cand[best].bonus)best=i})}
  const ci=await ask(p,{head:o.head,color:o.color,title:o.title2,text:o.include?'<small>今の恋人＋新しい出会い。タップして決定</small>':'<small>タップして決定</small>',btns:cand.map(c=>spouseHtml(c,c===o.include?'💗 今の恋人':'')),pick:best,col:true,profile:true,wide:true});
  return cand[ci];
}
const PET_DEF={
  dog:{label:'犬',names:['ポチ','コロ','マロン','ムギ','ハチ','レオ','モカ'],breeds:[['柴犬',0xd89a52],['トイプードル',0xf3e6d0],['ゴールデン',0xe8b45a],['ダックス',0x8a4b2a],['ハスキー',0xb9c4d0],['黒ラブ',0x2f2a2a]]},
  cat:{label:'猫',names:['タマ','ミケ','ルナ','ソラ','チャチャ','ココ','ミルク'],breeds:[['三毛猫',0xf0d9b5],['黒猫',0x2b2b33],['白猫',0xfafafa],['トラ猫',0xb98550],['アメショ',0xb7b7bd],['茶トラ',0xe99b4a]]}
};
const PET_TRAIT=['元気いっぱい','おとなしい','食いしん坊','甘えん坊','いたずら好き','かしこい'];
function genPets(species,baby){
  const d=PET_DEF[species],used=new Set(),out=[];
  while(out.length<3){
    const nm=pickOf(d.names);if(used.has(nm))continue;used.add(nm);
    const b=pickOf(d.breeds);out.push({species,name:nm,breed:b[0],col:b[1],age:baby?0:rnd(4),trait:pickOf(PET_TRAIT)});
  }
  return out;
}
function petHtml(pt){
  return `<img class="pimg" src="${portraitPet(pt)}" alt=""><div class="pi"><b>${esc(pt.name)}</b> ${pt.age}歳・${PET_DEF[pt.species].label}<br>🐾${esc(pt.breed)}<br>💬${esc(pt.trait)}</div>`;
}
async function choosePet(p,baby){
  const si=await ask(p,{head:baby?'🐾 ペットに赤ちゃん！':'🐾 ペットをむかえよう',color:'#ff9a3d',title:baby?'生まれたのは、犬？ 猫？':'犬と猫、どっちにする？',text:'まず種類を選んでください',btns:['🐶 犬','🐱 猫'],pick:rnd(2),col:true});
  const cand=genPets(si===0?'dog':'cat',baby);
  const ci=await ask(p,{head:'🐾 ペットのプロフィールカード',color:'#ff9a3d',title:'3匹の中から選ぼう',text:'<small>タップして決定</small>',btns:cand.map(petHtml),pick:rnd(3),col:true,profile:true,wide:true});
  p.petList.push(cand[ci]);p.pets++;V.pins(p);
  say(p,`${p.name} の家に ${cand[ci].name}（${cand[ci].breed}）がやってきた！`);
}
async function stepAndLand(p){                 // 分岐を選んだら、すぐ最初のマスの支払い・収入を実行する
  const nk=nextKey(p);if(!nk)return;
  p.pos=nk;await V.step(p,nk);await land(p);
}

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
SP['15']=async p=>{await choosePet(p,false);await famBonus(p,'15')};
SP['16']=async p=>{const r=await duelRoll(p,x=>x>=8);if(r>=8){say(p,'優勝！ +10,000');await income(p,10000)}else say(p,'惜しくも入賞ならず')};
SP['19']=async p=>{p.again=true;say(p,'もう一度ルーレットを回せます！')};
SP['20']=async p=>{
  const cpuU=p.cash>=20000||Math.random()<.5;
  const i=await ask(p,{head:'マス20　進路決定',color:'#c98a00',title:'どちらの道に進む？',text:'大学ルート：学費がかかるが専門職に就ける<br>就職ルート：早く稼ぎ始める（一般職）',btns:['🎓 大学ルート','💼 就職ルート'],pick:cpuU?0:1,col:true,branch:'20'});
  p.route=i===0?'U':'W';say(p,`${p.name}は${i===0?'大学':'就職'}ルートへ`);
  await stepAndLand(p);
};
SP['26']=async p=>{const r=await duelRoll(p,x=>x===7);if(r===7){say(p,'当選！ +50,000');await income(p,50000);Sound.good()}else say(p,'はずれ')};
SP['31']=async p=>{
  const c=await choosePerson(p,{role:'lover',head:'💗 恋人ができる',color:'#ff6fa5',q:'どんな人とおつきあいする？',title2:'3人の中から、恋人を選ぼう'});
  p.loverInfo=c;p.lover=true;V.pins(p);say(p,`${p.name} に恋人 ${c.name} さんができた！`);await famBonus(p,'31');
};
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
  const need=p.loverInfo?3:5;                                  // 結婚できるかは、ルーレットの出目しだい
  await ask(p,{head:'💍 プロポーズ！',color:'#ff6fa5',title:'結婚できるかな？',text:`ルーレットで <b>${need}以上</b> が出れば結婚成立！<br><small>${p.loverInfo?'恋人がいるので成功しやすい（3以上）':'恋人がいないので少し難しい（5以上）'}</small>`,btns:['ルーレットへ'],pick:0});
  const r=await duelRoll(p,x=>x>=need);
  if(r<need){
    Sound.bad();p.lover=false;p.loverInfo=null;V.pins(p);
    await ask(p,{head:'💔 結婚できなかった…',color:'#8a8aa0',title:`出目は ${r}。縁がなかったみたい`,text:'ひとりで自由に生きていこう。お気楽ライフのご褒美に +20,000円',btns:['OK'],pick:0});
    say(p,`${p.name} は結婚せず、自由気ままに生きることに…`);await income(p,20000);return;
  }
  const had=p.loverInfo;
  const c=await choosePerson(p,{role:'spouse',head:'💍 結婚！ 相手を選ぼう',color:'#ff6fa5',q:'どんな人と結婚する？',title2:'3人の中から、結婚相手を選ぼう',gender:had&&had.gender,include:had});
  p.spouseInfo={...c,role:'spouse',bonus:[0,1000,3000,5000][c.inc]};
  say(p,`${p.name} は ${c.name} さんと結婚！`);
  p.spouse=true;p.lover=false;p.loverInfo=null;V.pins(p);Sound.good();
  await gifts(p,5000,'結婚');
  if(had&&c===had){say(p,'恋人からのプロポーズ成功！ 祝い金+10,000円');await income(p,10000,{celebrate:true})}
  if(jobAb(p)==='wed5'){say(p,'美容師の能力で+5,000円');await income(p,5000)}
  V.confetti(p.pos);
};
const BOY_N=['ハルキ','ソウマ','レン','ユウト','アオイ','タイガ','コウタ','リク','ヒビキ'],GIRL_N=['ミオ','サラ','ヒマリ','ユイナ','ココロ','アカリ','リン','ナナミ','ツムギ'];
async function baby(p,n,id){
  if(!p.spouse){say(p,'パートナーがいないので、子どもには恵まれなかった…');await ask(p,{head:'👶 子ども',color:'#8a8aa0',title:'子どもには恵まれなかった',text:'<small>（パートナーがいないので対象外です）</small>',btns:['OK'],pick:0});return}
  if(n===1&&Math.random()<.12){n=2;V.banner('👶👶 なんと双子！');say(p,'なんと、双子が生まれた！')}
  for(let i=0;i<n;i++){
    const g=Math.random()<.5?'f':'m',pool=shuffle([...(g==='f'?GIRL_N:BOY_N)].filter(n=>!p.kidList.some(k=>k.name===n))).slice(0,3);   // 兄弟で名前がかぶらない
    const ni=await ask(p,{head:`👶 ${n===2?(i+1)+'人目：':''}子ども誕生！`,color:'#ff9a3d',title:g==='f'?'女の子が生まれました！':'男の子が生まれました！',text:'名前をつけてあげよう',btns:pool,pick:rnd(3),col:true});
    p.kidList.push({name:pool[ni],gender:g,bornAge:ageOfKey(p.pos),cloth:KID_COL[p.kidList.length%KID_COL.length]});
    p.kids=p.kidList.length;
    say(p,`${p.name} に${g==='f'?'女の子':'男の子'}「${pool[ni]}」が誕生！`);
  }
  V.pins(p);Sound.good();
  await gifts(p,2000,'出産');
  if(jobAb(p)==='baby3'){say(p,'保育士の能力で+3,000円');await income(p,3000)}
  await famBonus(p,id);V.confetti(p.pos);
}
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
  await stepAndLand(p);
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
SP['102']=async p=>{await choosePet(p,true);await famBonus(p,'102')};
SP['106']=async p=>{
  await travelBonus(p,'106');
  const r=await duelRoll(p,x=>x%2===1);
  if(r%2===1){say(p,'勝ち！ +20,000');await income(p,20000)}else{say(p,'負け… −20,000');await pay(p,20000,{discount:false})}
};
SP['110']=async p=>{
  const cpuYes=salaryOf(p)*.5*7<50000;
  const i=await ask(p,{head:'早期退職の誘い',color:'#3f8cff',title:'早期退職を受ける？',text:'受けると +50,000円。ただし以降の給料は半分になります',btns:['受ける','受けない'],pick:cpuYes?0:1});
  if(i===0){p.halfPay=true;await income(p,50000);say(p,'早期退職を受けた（以降の給料は半分）')}
};
SP['117']=async p=>{p.grand++;V.pins(p);await income(p,5000);say(p,'孫が誕生！ 孫ピンが増えた');await famBonus(p,'117')};
SP['129']=async p=>{p.grand++;V.pins(p);await income(p,5000);say(p,'孫が誕生！ 孫ピンが増えた');await famBonus(p,'129')};
SP['115']=async p=>{
  if(!p.kids){say(p,'子どもがいないので0円');return}
  let a=10000;if(jobAb(p)==='teach'){a=5000;say(p,'教師の能力で半額')}await pay(p,a);
};
SP['108']=async p=>{if(!p.kids){say(p,'子どもがいないので0円');return}await redSq(p,SQ['108'])};
SP['119']=async p=>{const r=await duelRoll(p);say(p,`出た数 ${r} × 3,000`);await income(p,r*3000)};
SP['123']=async p=>{
  const go=p.cash>=60000;
  const i=await ask(p,{head:'世界一周旅行',color:'#3f8cff',title:'世界一周に行く？',text:'行くなら −30,000円。ゴール時に思い出ボーナス +50,000円',btns:['行く','行かない'],pick:go?0:1});
  if(i===0){await pay(p,30000);p.memory=true;say(p,'世界一周へ出発！');await travelBonus(p,'123')}
};
SP['128']=async p=>{if(p.job&&!p.retired){say(p,'講演料：給料1回分');await income(p,salaryOf(p))}else say(p,'給料がないので0')};
SP['132']=async p=>{const r=await duelRoll(p,x=>x===10);if(r===10){say(p,'1等！ +100,000');await income(p,100000);Sound.fanfare()}else say(p,'はずれ')};
SP['136']=async p=>{
  const s=salaryOf(p)*3;say(p,`退職！ 退職金 ${fmt(s)}円`);await income(p,s);
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
SP['S7']=async p=>{await travelBonus(p,'S7');let a=2000*p.kids;if(jobAb(p)==='teach')a=Math.ceil(a/2);if(a>0)await pay(p,a);else say(p,'子どもがいないので0円')};
SP['109']=async p=>{let a=25000;if(jobAb(p)==='patent'){a*=2;say(p,'エンジニアの能力で2倍！')}await income(p,a)};
SP['57']=async p=>{await income(p,5000,{celebrate:true})};

/* ---------- リアルな人生のできごと（失業・浮気・愛人・離婚・子どもがぐれる…） ---------- */
function doDivorce(p){p.spouse=false;p.spouseInfo=null;p.spouseJobless=0;V.pins(p)}
const ARRESTS=[
  {why:'飲酒運転',bail:30000,rest:1},{why:'万引き',bail:10000,rest:1},{why:'ネットでの誹謗中傷',bail:40000,rest:1},
  {why:'ケンカで相手にケガをさせた',bail:50000,rest:2},{why:'脱税',bail:100000,rest:2},{why:'詐欺',bail:150000,rest:3}];
const ARREST_ROLL=['万引き','万引き','ネットでの誹謗中傷','飲酒運転','飲酒運転','ケンカで相手にケガをさせた','ケンカで相手にケガをさせた','脱税','脱税','詐欺'];   // 出目1〜10 → 罪状（数字が大きいほど重い）
async function arrest(p,force,dashForce){
  const dash=dashForce!==undefined?dashForce:Math.random()<.04;            // ごくまれに、モッズコートの警察官がダッシュで来る
  let r=force;
  if(!r){                                                    // ① まず罪状が確定する（ルーレットの出目）
    await ask(p,{head:'🚨 罪が発覚！',color:'#e8454c',title:'何をやらかした？',text:'<b>ルーレットの出目で罪状が決まります</b><br><small>1〜2 万引き ／ 3 ネットでの誹謗中傷 ／ 4〜5 飲酒運転 ／ 6〜7 ケンカ（ケガ） ／ 8〜9 脱税 ／ 10 詐欺<br>数字が大きいほど重い罪です</small>',btns:['ルーレットを回す'],pick:0});
    const n=await spin(p,'duel');                            // 能力による出目補正はなし
    r=ARRESTS.find(x=>x.why===ARREST_ROLL[n-1]);
    say(p,`${p.name} の出目は ${n}… 罪状は「${r.why}」で確定！`);
    await sleep(600);
  }
  Sound.bad();
  V.banner(dash?'🏃 モッズコートの警察官がダッシュで来た！':'🚨 警察が来た！');       // ② 罪が確定したあとに、警察官が来る
  await V.policeDispatch(p,dash);                            // 警察署から、警官がそのマスまで来る
  const i=await ask(p,{head:'🚨 逮捕！',color:'#e8454c',title:`「${r.why}」で逮捕されました`,text:`${dash?'モッズコートの警察官に捕まった！ 連れていかれる前に':'パトカーに乗せられる前に'}、どうするか決めよう<br><small>保釈金を払えば、その場で釈放。払わない場合は、${dash?'走って連行され':'パトカーで'}警察署の留置所へ行き<b>${r.rest}回休み</b>です</small>`,btns:[`保釈金 ${fmt(r.bail)}円を払う`,`${r.rest}回休み（留置所へ）`],pick:p.cash>=r.bail*1.5?0:1,col:true});
  if(i===0){
    say(p,`${p.name} は「${r.why}」で逮捕… 保釈金 ${fmt(r.bail)}円を払って釈放`);
    await pay(p,r.bail,{discount:false});await V.policeLeave(p,dash);
  }else{
    say(p,`${p.name} は「${r.why}」で逮捕… ${dash?'走って連行され':'パトカーで'}留置所へ（${r.rest}回休み）`);
    p.skip=Math.max(p.skip,r.rest);p.inJail=true;
    await V.policeTake(p,dash);
  }
}
const LIFE={
  arrest:{ok:p=>ageOfKey(p.pos)>=18&&!p.inJail,w:2,run:async p=>{await arrest(p)}},
  jobless:{ok:p=>p.job&&!p.retired,w:2,run:async p=>{
    await ask(p,{head:'💼 人生のできごと',color:'#e8454c',title:'会社が倒産…！ 失業しました',text:'次の2回の給料日は、<b>失業手当（給料の30%）</b>だけになります',btns:['OK'],pick:0});
    p.jobless=2;say(p,`${p.name} が失業… 次の2回の給料日は30%`)}},
  mateJobless:{ok:p=>p.spouse&&p.spouseInfo&&p.spouseInfo.bonus>0&&p.spouseJobless===0,w:2,run:async p=>{
    await ask(p,{head:'💼 人生のできごと',color:'#e8454c',title:`${p.spouseInfo.name}さんが失業した！`,text:'次の3回の給料日は、共働き収入がなくなります。励ましに 5,000円',btns:['OK'],pick:0});
    p.spouseJobless=3;say(p,`${p.spouseInfo.name}さんが失業… 共働きが3回おやすみ`);await pay(p,5000)}},
  cheated:{ok:p=>p.spouse&&p.spouseInfo,w:1,run:async p=>{
    Sound.bad();
    const i=await ask(p,{head:'💔 人生のできごと',color:'#e8454c',title:`${p.spouseInfo.name}さんの浮気が発覚！`,text:'許してやり直す？ それとも離婚する？<br><small>離婚すると慰謝料 +30,000円がもらえます</small>',btns:['許してやり直す','離婚する'],pick:p.spouseInfo.bonus>=3000?0:1,col:true});
    if(i===0){p.spouseInfo.bonus=Math.floor(p.spouseInfo.bonus/2);say(p,'許したけれど、信頼がゆらいで共働きの助けが減った…')}
    else{say(p,`${p.name} は離婚。慰謝料 +30,000円`);doDivorce(p);await income(p,30000)}}},
  affair:{ok:p=>(p.spouse||p.lover)&&!p.affairInfo,w:1,run:async p=>{
    const i=await ask(p,{head:'🖤 人生のできごと',color:'#6a4fd0',title:'魅力的な人に出会ってしまった…',text:'愛人をつくる？ それとも断る？<br><small>愛人は給料日ごとに −3,000円。バレると大変なことに…</small>',btns:['愛人をつくる','きっぱり断る（+3,000円）'],pick:Math.random()<.3?0:1,col:true});
    if(i===0){
      const c=await choosePerson(p,{role:'affair',head:'🖤 愛人のプロフィール',color:'#6a4fd0',q:'どんな人？',title2:'3人の中から、愛人を選ぼう'});
      p.affairInfo=c;say(p,`${p.name} に愛人 ${c.name} さんができた…（秘密）`);
    }else{say(p,'きっぱり断った。誠実さが評価されて +3,000円');await income(p,3000)}}},
  exposed:{ok:p=>p.spouse&&p.affairInfo,w:3,run:async p=>{
    Sound.bad();
    await ask(p,{head:'🔥 修羅場！',color:'#e8454c',title:'愛人のことがバレた！',text:`${p.spouseInfo.name}さんが激怒…離婚、そして慰謝料 <b>50,000円</b> を支払います`,btns:['OK'],pick:0});
    say(p,`${p.name} は愛人がバレて離婚… 慰謝料 −50,000円`);doDivorce(p);p.affairInfo=null;await pay(p,50000,{discount:false})}},
  divorce:{ok:p=>p.spouse&&p.spouseInfo,w:1,run:async p=>{
    const i=await ask(p,{head:'💔 人生のできごと',color:'#e8454c',title:'すれ違いが続いて、離婚の危機…',text:'やり直す？（ルーレットで<b>5以上</b>なら関係修復）<br><small>失敗か離婚を選ぶと、慰謝料 −20,000円</small>',btns:['やり直す','離婚する'],pick:0,col:true});
    let split=i===1;
    if(!split){const r=await duelRoll(p,x=>x>=5);if(r>=5){say(p,'話し合って、関係を修復できた！');Sound.good()}else split=true}
    if(split){say(p,`${p.name} は離婚… 慰謝料 −20,000円`);doDivorce(p);await pay(p,20000,{discount:false})}}},
  delinquent:{ok:p=>p.kids>0,w:2,run:async p=>{
    const k=pickOf(p.kidList);
    const i=await ask(p,{head:'😠 人生のできごと',color:'#e8454c',title:`${k.name}がグレた！`,text:'夜遊びに、ケンカ…どうする？<br><small>向き合う＝ルーレット<b>6以上</b>で立ち直る（失敗は −15,000円）／見守る＝器物破損の弁償 −8,000円</small>',btns:['しっかり向き合う','そっと見守る'],pick:0,col:true});
    if(i===0){const r=await duelRoll(p,x=>x>=6);if(r>=6){say(p,`${k.name}が立ち直った！ 親子の絆がふかまった`);Sound.good()}else{say(p,`${k.name}と衝突… 病院代など −15,000円`);await pay(p,15000)}}
    else{say(p,`${k.name}の起こしたトラブルの弁償 −8,000円`);await pay(p,8000)}}},
  cold:{ok:()=>true,w:0,run:async p=>{say(p,'風邪をひいて寝込んだ… −3,000円');await pay(p,3000)}}
};
async function lifeEvent(p,force){
  await ask(p,{head:'🎴 人生のできごと',color:'#6a4fd0',title:'何かが起こる予感…',text:'人生にはいろいろあります。今のあなたに起こるできごとは？',btns:['めくる'],pick:0});
  const pool=[];for(const[k,d]of Object.entries(LIFE)){if(d.ok(p))for(let i=0;i<d.w;i++)pool.push(k)}
  if(!pool.length)pool.push('cold');
  const k=force&&LIFE[force]?force:pickOf(pool);
  if(!force&&!LIFE[k].ok(p))return;                              // 条件に合わない出来事は起きない（子どもがいなければ「グレた」は出ない）
  await LIFE[k].run(p);V.hud();
}
// アイテムマスの一部を「人生のできごと」マスに置き換え（リアルな出来事）
['33','39','63','69','92','99','105','120','125'].forEach(id=>{const q=SQ[id];q.k='event';q.t='人生のできごと（何が起こるかはお楽しみ）';q.m='?';q.a=null;SP[id]=async p=>lifeEvent(p)});

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
const NEED_KID=new Set(['56','57','64','78','86','108','112','115','S7','117','129']);   // 子どもがいないと対象外
const NEED_MATE=new Set(['52']);                                                                  // パートナーがいないと対象外
async function land(p){
  await checkVehicle(p);
  const sq=SQ[p.pos];
  V.flash(p.pos);Sound.stopSq();
  V.bubble(p.pos,sq.t);
  const skip=NEED_KID.has(sq.id)&&p.kids===0?'子どもがいないので、このマスは対象外です':NEED_MATE.has(sq.id)&&!p.spouse?'パートナーがいないので、このマスは対象外です':'';
  await showSq(p,sq,skip);
  V.bubbleOff();
  if(sq.id!=='1'&&!skip)await landEffect(p,sq);
  // STOPマスの次もSTOPマスなら、また止まらずにそのまま続けて実行（例：卒業U12 → 合流21）
  if(!p.finished&&sq.id!=='150'&&p.pos===sq.id&&isStop(sq)){
    const nk=nextKey(p);
    if(nk&&isStop(SQ[nk])){p.pos=nk;await V.step(p,nk);await land(p);return}
  }
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
  if(p.chased){p.chased=false;await V.thugsLeave(p)}
  V.hud();recordHist(p);Sound.fanfare();V.confetti(p.pos);V.finishCar(p);
  const rows=rep.map(r=>`<tr><td>${r[0]}</td><td class="${r[1]<0?'minus':''}">${fmt(r[1])}</td></tr>`).join('');
  await ask(p,{head:`🏁 ゴール！ ${p.rank}着`,color:'#c98a00',title:`${p.name} の最終決算`,text:`<table class="tbl">${rows}<tr><th>総資産</th><th>${fmt(p.final)}円</th></tr></table>`,btns:['OK'],pick:0});
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
    const i=await ask(p,{head:'バックギア',color:'#8e6bff',title:'誰を3マス戻す？',text:'STOPマスは越えません',btns:[...L.map(q=>q.name),'やめる'],pick:L.indexOf(lead),col:true});
    if(i>=L.length){say(p,'バックギアの使用をやめた');return}
    takeItem(p,'back');const t=L[i];say(p,`${t.name}を3マス戻した！`);await backward(t,3);
  }else if(c==='swap'){
    const L=others(p).filter(q=>q.job);
    const best=L.reduce((a,b)=>b.job.sal>a.job.sal?b:a,L[0]);
    const i=await ask(p,{head:'職業交換チケット',color:'#8e6bff',title:'誰と職業を交換する？',text:`あなたの職業：${p.job.n}`,btns:[...L.map(q=>`${q.name}（${q.job.n}）`),'やめる'],pick:L.indexOf(best),col:true});
    if(i>=L.length){say(p,'職業交換チケットの使用をやめた');return}
    takeItem(p,'swap');const t=L[i];[p.job,t.job]=[t.job,p.job];say(p,`${p.name}と${t.name}が職業を交換！`);V.hud();V.pins(p);V.pins(t);
  }else if(c==='map'){
    takeItem(p,'map');const r=await spin(p,'duel');
    if(r===10){say(p,'宝を発見！ +50,000');await income(p,50000);Sound.fanfare()}else say(p,`出た数${r}… 宝は見つからなかった`);
  }else if(c==='key'){
    takeItem(p,'key');p.notes--;p.cash-=NOTE_LOAN;checkChase(p);say(p,'金庫カギで手形1枚を利息なしで返済！');Sound.stamp();V.hud();
  }else if(c==='coupon'){takeItem(p,'coupon');p.coupon=true;say(p,'次の支払いが半額になります')}
  else if(c==='boost'){takeItem(p,'boost');p.booster=true;say(p,'次にもらうお祝い金が2倍になります')}
  V.hud();
}
async function cpuItems(p){
  if(p.notes>0&&p.cash>=p.notes*NOTE_BACK+20000)await repayNotes(p,p.notes);          // CPU：余裕ができたら手形を返す
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
  V.focus(p);V.hud();await V.turnIntro(p);
  if(p.skip>0){
    if(has(p,'nap')){
      const i=await ask(p,{head:'1回休み',color:'#e8454c',title:'おやすみ免除券を使う？',text:'使うと休まずに進めます',btns:['使う','休む'],pick:0});
      if(i===0){takeItem(p,'nap');p.skip=0;say(p,'おやすみ免除券を使った！');V.hud();if(p.inJail){p.inJail=false;await V.release(p)}}
    }
    if(p.skip>0){
      p.skip--;say(p,`${p.name}は1回休み${p.inJail?'（留置所）':''}`);await sleep(700);
      if(p.inJail&&p.skip===0){say(p,`${p.name}は釈放されました`);p.inJail=false;await V.release(p)}      // 休みが明けたら留置所から出る
      recordHist(p);return;
    }
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
  recordHist(p);
}

function setupGame(list){
  G.players=list.map((o,i)=>newPlayer(i,o.name,o.cpu,o.color,o.cloth,o.gender));
  G.cur=0;G.order=[];G.over=false;G.turnNo=0;
  G.stockOwner=Array(11).fill(null);G.houseTaken=Array(HOUSES.length).fill(false);
  G.hist={};buildItemDeck();buildJobDecks();G.players.forEach(recordHist);
}
async function bonusTurn(p){                 // 先に上がった人も、ルーレットを回して「10,000円×出目」をもらえる
  V.focus(p);V.hud();await V.turnIntro(p,'ボーナスルーレット！');
  const r=await spin(p,'bonus');
  const amt=10000*r;
  say(p,`${p.name}：ボーナスルーレット ${r} × 10,000円 = +${fmt(amt)}円`);Sound.good();
  await income(p,amt);p.bonusTotal+=amt;p.final=p.cash;recordHist(p);
}
async function playGame(){
  while(active().length&&!G.over){
    const p=G.players[G.cur];
    if(!p.finished){G.turnNo++;await takeTurn(p)}
    else if(!p.left&&active().length)await bonusTurn(p);
    G.cur=(G.cur+1)%G.players.length;
    if(G.turnNo>2500){break}      // 念のための安全弁
  }
  await V.results();
}
