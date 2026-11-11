// ===== テストモード：確認用パネル（ホストが待機ルームでオンにしたときだけ・ホスト自身のプレイヤーだけに作用） =====
let testBusy=false;
const TEST_JUMPS=[['15','🐾 ペット'],['102','🐾 ペット赤ちゃん'],['31','💗 恋人'],['51','💍 結婚'],['54','👶 出産'],['61','👶 双子'],['70','🏠 家を買う'],
  ['20','🎓 進路(分岐)'],['U12','🎓 卒業→合流'],['W1','💼 就職'],['80','🚀 生き方(分岐)'],['R1','🚀 起業'],['34','📈 株'],['5','🎁 アイテム'],['41','🔄 転職'],
  ['110','🏖 早期退職'],['123','🌍 世界一周'],['136','🌴 退職'],['145','🎰 賭け'],['149','📸 記念写真'],['150','🏁 ゴール'],['26','🎟 宝くじ売り場'],['44','🎊 宝くじ抽選会'],['36','📰 景気ニュース'],['93','📈 株価の変動'],['29','✨ 昇進(ランクアップ)']];
const myTestPlayer=()=>G.players[NET.myPid];
function initTestPanel(){
  $('#btnTest').classList.remove('hidden');
  const P=$('#testPanel');
  P.innerHTML=`<div class="th"><span>🧪 テストパネル（ホストだけ）</span><button id="tpClose" class="alt">×</button></div>
   <div class="tn">ジャンプ・職業・アイテムは「自分の番のルーレット前」に使えます</div>
   <div class="tsec">マスへジャンプ（そのマスの内容をすぐ実行）</div><div id="tpJump" class="tgrid"></div>
   <div class="trow" style="margin-top:4px"><input id="tpKey" type="text" placeholder="マス番号 例: 95 / U3 / R5"><button id="tpGo" class="gold">行く</button></div>
   <div class="tsec">ルーレットの出目を固定（次の1回だけ）</div><div id="tpRoll" class="tgrid"></div>
   <div class="tsec">お金</div><div id="tpMoney" class="tgrid"></div>
   <div class="tsec">リアルなできごと（必要な家族は自動で付きます）</div><div id="tpLife" class="tgrid"></div>
   <div class="tsec">家族・年齢</div><div id="tpFam" class="tgrid"></div>
   <div class="tsec">職業</div><div class="trow"><select id="tpJob"></select><button id="tpJobBtn" class="gold">変更</button></div>
   <div class="tsec">アイテム</div><div class="trow"><select id="tpItem"></select><button id="tpItemBtn" class="gold">追加</button></div>
   <div class="tgrid" style="margin-top:4px"><button id="tpAllCol" class="green">お宝を全部</button><button id="tpAllIns" class="green">保険を全部</button><button id="tpAllUse" class="green">使い切りを全部</button></div>`;
  $('#tpJump').innerHTML=TEST_JUMPS.map(j=>`<button data-k="${j[0]}">${j[1]}<small> ${j[0]}</small></button>`).join('');
  $('#tpJump').querySelectorAll('button').forEach(b=>b.onclick=()=>testJump(b.dataset.k));
  $('#tpGo').onclick=()=>testJump($('#tpKey').value.trim().toUpperCase());
  const LIFE_BTNS=[['arrest','🚨逮捕'],['arrestDash','🏃ダッシュ逮捕'],['jobless','失業'],['mateJobless','配偶者失業'],['cheated','浮気された'],['affair','愛人チャンス'],['exposed','愛人バレる'],['divorce','離婚の危機'],['delinquent','子がグレる']];
  $('#tpLife').innerHTML=LIFE_BTNS.map(b=>`<button data-k="${b[0]}">${b[1]}</button>`).join('');
  $('#tpLife').querySelectorAll('button').forEach(b=>b.onclick=()=>testLife(b.dataset.k));
  $('#tpFam').innerHTML='<button data-f="notes">🕶手形3枚(取り立て屋)</button><button data-f="pay">手形を全部返す</button><button data-f="mate">配偶者を付ける</button><button data-f="kids">子ども2人</button><button data-f="aff">愛人を付ける</button><button data-f="job">職業(医者)</button>';
  $('#tpFam').querySelectorAll('button').forEach(b=>b.onclick=()=>{testFamily(b.dataset.f);V.hud()});
  $('#tpRoll').innerHTML=[1,2,3,4,5,6,7,8,9,10].map(n=>`<button data-n="${n}">${n}</button>`).join('')+'<button data-n="0" class="alt">ランダム</button>';
  $('#tpRoll').querySelectorAll('button').forEach(b=>b.onclick=()=>{TestMode.roll=+b.dataset.n;V.toast(TestMode.roll?`次の出目を ${TestMode.roll} に固定`:'出目はランダム')});
  $('#tpMoney').innerHTML=[[100000,'+10万円'],[1000000,'+100万円'],[-100000,'−10万円']].map(m=>`<button data-m="${m[0]}">${m[1]}</button>`).join('')+'<button data-m="reset" class="alt">財布を空に</button>';
  $('#tpMoney').querySelectorAll('button').forEach(b=>b.onclick=()=>{const p=myTestPlayer();p.cash=b.dataset.m==='reset'?0:Math.max(0,p.cash+(+b.dataset.m));V.hud()});
  $('#tpJob').innerHTML='<option value="">（なし＝学生）</option>'+JOBS.map(j=>`<option value="${j.n}">${j.n}（${j.deck==='s'?'専門':'一般'}）</option>`).join('');
  $('#tpJobBtn').onclick=()=>{const p=myTestPlayer(),n=$('#tpJob').value;returnJob(p.job);p.job=n?{...JOBS.find(j=>j.n===n)}:null;p.retired=false;V.hud();V.pins(p)};
  $('#tpItem').innerHTML=ITEMS.map(i=>`<option value="${i.c}">${i.n}</option>`).join('');
  $('#tpItemBtn').onclick=()=>{const p=myTestPlayer();p.items.push({...ITEM_BY_CODE[$('#tpItem').value]});V.hud()};
  const all=ty=>()=>{const p=myTestPlayer();ITEMS.filter(i=>i.ty===ty).forEach(i=>{if(!has(p,i.c))p.items.push({...i})});V.hud()};
  $('#tpAllCol').onclick=all('col');$('#tpAllIns').onclick=all('ins');$('#tpAllUse').onclick=all('use');
  $('#tpClose').onclick=()=>P.classList.add('hidden');
  $('#btnTest').onclick=()=>P.classList.toggle('hidden');
}
async function testJump(key){
  const p=myTestPlayer();
  if(!SQ[key]){V.toast(`マス「${key}」はありません`);return}
  if(G.awaiting!==p){V.toast('自分の番のルーレット前に使ってください');return}
  if(testBusy)return;testBusy=true;
  try{
    const s=SQ[key];
    if(s.r==='U'||s.r==='W')p.route=s.r;else if(s.r==='S'||s.r==='R')p.route2=s.r;
    p.route=p.route||'U';p.route2=p.route2||'S';
    p.pos=key;await V.step(p,key);await land(p);V.hud();
  }finally{testBusy=false}
}

function testFamily(what){
  const p=myTestPlayer();
  if(what==='notes'){p.notes=Math.max(3,p.notes);p.cash=Math.min(p.cash,5000);checkChase(p);V.hud();return}
  if(what==='pay'){p.cash=Math.max(p.cash,p.notes*NOTE_BACK);repayNotes(p,p.notes);return}
  if(what==='mate'&&!p.spouse){p.spouseInfo=genPerson(p.gender==='f'?'m':'f',p,'spouse');p.spouse=true;p.lover=false;p.loverInfo=null}
  if(what==='kids'){for(let i=0;i<2;i++){const g=i?'f':'m';p.kidList.push({name:(g==='f'?GIRL_N:BOY_N)[i],gender:g,bornAge:Math.max(0,ageOfKey(p.pos)-8),cloth:KID_COL[p.kidList.length%KID_COL.length]})}p.kids=p.kidList.length}
  if(what==='aff'&&!p.affairInfo)p.affairInfo=genPerson('f',p,'affair');
  if(what==='job'&&!p.job)p.job={...JOBS.find(j=>j.n==='医者')};
  V.pins(p);
}
async function testLife(k){
  const p=myTestPlayer();
  if(G.awaiting!==p){V.toast('自分の番のルーレット前に使ってください');return}
  if(testBusy)return;testBusy=true;
  try{
    if(['mateJobless','cheated','affair','exposed','divorce'].includes(k))testFamily('mate');
    if(k==='exposed')testFamily('aff');
    if(k==='delinquent')testFamily('kids');
    if(k==='jobless')testFamily('job');
    if(k==='mateJobless'){p.spouseInfo.bonus=Math.max(p.spouseInfo.bonus,3000);p.spouseJobless=0}
    if(k==='arrestDash')await arrest(p,undefined,true);else await lifeEvent(p,k);
  }finally{testBusy=false}
}
