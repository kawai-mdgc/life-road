// ===== テストモード：確認用パネル（ホストが待機ルームでオンにしたときだけ・ホスト自身のプレイヤーだけに作用） =====
let testBusy=false;
const TEST_JUMPS=[['15','🐾 ペット'],['102','🐾 ペット赤ちゃん'],['31','💗 恋人'],['51','💍 結婚'],['54','👶 出産'],['61','👶 双子'],['70','🏠 家を買う'],
  ['20','🎓 進路(分岐)'],['U12','🎓 卒業→合流'],['W1','💼 就職'],['80','🚀 生き方(分岐)'],['R1','🚀 起業'],['34','📈 株'],['5','🎁 アイテム'],['41','🔄 転職'],
  ['110','🏖 早期退職'],['123','🌍 世界一周'],['136','🌴 退職'],['145','🎰 賭け'],['149','📸 記念写真'],['150','🏁 ゴール']];
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
   <div class="tsec">職業</div><div class="trow"><select id="tpJob"></select><button id="tpJobBtn" class="gold">変更</button></div>
   <div class="tsec">アイテム</div><div class="trow"><select id="tpItem"></select><button id="tpItemBtn" class="gold">追加</button></div>
   <div class="tgrid" style="margin-top:4px"><button id="tpAllCol" class="green">お宝を全部</button><button id="tpAllIns" class="green">保険を全部</button><button id="tpAllUse" class="green">使い切りを全部</button></div>`;
  $('#tpJump').innerHTML=TEST_JUMPS.map(j=>`<button data-k="${j[0]}">${j[1]}<small> ${j[0]}</small></button>`).join('');
  $('#tpJump').querySelectorAll('button').forEach(b=>b.onclick=()=>testJump(b.dataset.k));
  $('#tpGo').onclick=()=>testJump($('#tpKey').value.trim().toUpperCase());
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
