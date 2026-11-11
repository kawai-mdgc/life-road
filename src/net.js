// ===== オンライン対戦（PeerJS / WebRTC P2P・ルームコード方式）=====
// ホストがゲーム進行（rules.js）をすべて実行し、参加者の画面には「表示イベント」と「状態スナップショット」を配信する。
// 参加者は自分の番の入力（カードの選択・ルーレット・アイテム使用）だけをホストへ送る。
const ICE={iceServers:[
  {urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'},
  {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
  {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}]};
const NET={on:false,isHost:false,peer:null,code:'',conns:[],slots:[],nSlots:4,myPid:0,rid:1,pend:{},hostConn:null,started:false,name:'あなた'};
NET.send=m=>{if(NET.hostConn&&NET.hostConn.open)NET.hostConn.send(m)};
const bc=m=>{if(!(NET.on&&NET.isHost))return;NET.conns.forEach(c=>{if(c.conn.open)c.conn.send(m)})};
const sendTo=(c,m)=>{if(c&&c.conn.open)c.conn.send(m)};
const connOf=pid=>NET.conns.find(c=>c.pid===pid);
const isRemote=p=>NET.on&&NET.isHost&&p&&!p.cpu&&p.id!==NET.myPid;
const pidOf=x=>x==='bank'?'bank':x.id;
const unPid=x=>x==='bank'?'bank':G.players[x];

/* ---------- ホスト：表示イベントの配信（V.* をラップ） ---------- */
(function hostWrap(){
  const ev=(name,ser)=>{const o=V[name];V[name]=(...a)=>{bc({t:'ev',n:name,a:ser?ser(...a):a});return o(...a)}};
  ev('toast');ev('log');ev('banner');
  ev('step',(p,k)=>[p.id,k]);
  ev('bills',(f,t,amt)=>[pidOf(f),pidOf(t),amt]);
  ev('flash');ev('bubble');ev('bubbleOff');
  ev('confetti',at=>[typeof at==='string'?at:null]);
  ev('buildHouse',(p,h)=>[p.id,h]);
  ev('upgradeCar',p=>[p.id]);ev('finishCar',p=>[p.id]);
  // 状態スナップショット（hud が呼ばれるたびに、まとめて1回だけ送る）
  const hud=V.hud;let pending=false;
  V.hud=()=>{
    hud();
    if(!(NET.on&&NET.isHost)||pending)return;
    pending=true;setTimeout(()=>{pending=false;sendSnap()},25);
  };
  // 効果音（ルール側で鳴らすものだけ参加者にも鳴らす）
  ['good','bad','stamp','stopSq','fanfare'].forEach(n=>{const o=Sound[n];Sound[n]=()=>{bc({t:'snd',n});o()}});
  // ルーレット：入力待ち→演出を全員に配信
  const wait=V.waitSpin;
  V.waitSpin=(p,purpose)=>{
    if(!isRemote(p))return wait(p,purpose);
    return new Promise(res=>{
      const rid=NET.rid++;NET.pend[rid]={res,pid:p.id,kind:'spin'};
      sendTo(connOf(p.id),{t:'spinWait',rid,pur:purpose});
      V.toast(`${p.name} がルーレットを回します…`);
    });
  };
  const rA=V.rouletteAnim;V.rouletteAnim=(r,pur)=>{bc({t:'ev',n:'rouletteAnim',a:[r,pur]});return rA(r,pur)};
  const results=V.results;V.results=async()=>{sendSnap();bc({t:'results'});await results()};
  // カード：本人にだけボタンを出し、他の人は観戦表示
  const clean=(o)=>{const c={...o};delete c.sq;delete c.cpu;delete c.pick;return c};
  V.card=(o,p)=>{
    if(!(NET.on&&NET.isHost))return cardLocal(o,p);
    const pid=p?p.id:-1;
    if(!isRemote(p)){
      bc({t:'card',o:{...clean(o),spec:true},pid});
      return cardLocal(o,p).then(i=>{bc({t:'cardClose'});return i});
    }
    return new Promise(res=>{
      const rid=NET.rid++;
      NET.pend[rid]={res,pid,kind:'card',pick:o.pick||0};
      NET.conns.forEach(c=>{if(c.pid===pid)sendTo(c,{t:'card',o:clean(o),pid,rid});else sendTo(c,{t:'card',o:{...clean(o),spec:true},pid})});
      cardLocal({...clean(o),spec:true},p);          // ホスト自身も観戦
    });
  };
})();
function sendSnap(){bc({t:'snap',cur:G.cur,turn:G.turnNo,aw:G.awaiting?G.awaiting.id:-1,p:G.players})}
function resolvePend(rid,val){
  const q=NET.pend[rid];if(!q)return;delete NET.pend[rid];
  if(q.kind==='card'){if(cardCloseFn)cardCloseFn();bc({t:'cardClose'})}
  q.res(val);
}

/* ---------- ホスト：参加者からの入力 ---------- */
function hostRecv(c,m){
  if(!m||typeof m!=='object')return;
  if(m.t==='join'){
    if(NET.started){c.conn.send({t:'full',why:'ゲームはすでに始まっています'});return}
    const i=NET.slots.findIndex((s,k)=>k>0&&s.kind==='open');
    if(i<0){c.conn.send({t:'full',why:'ルームが満員です'});return}
    c.slot=i;NET.slots[i]={kind:'human',name:String(m.name||'ゲスト').slice(0,8)};
    c.conn.send({t:'welcome',slot:i});lobbyUpdate();return;
  }
  if(!NET.started||c.pid===undefined)return;
  if(m.t==='cardAns'){const q=NET.pend[m.rid];if(q&&q.pid===c.pid&&q.kind==='card')resolvePend(m.rid,+m.i||0)}
  else if(m.t==='spinGo'){const q=NET.pend[m.rid];if(q&&q.pid===c.pid&&q.kind==='spin')resolvePend(m.rid)}
  else if(m.t==='useItem'){
    const p=G.players[c.pid];
    if(p&&G.awaiting===p&&typeof m.c==='string'&&usableItems(p).includes(m.c))useItem(p,m.c);
  }
}
function hostLeft(c){
  if(!NET.started){
    NET.conns=NET.conns.filter(x=>x!==c);
    if(c.slot){NET.slots[c.slot]={kind:'open',name:''}}
    lobbyUpdate();return;
  }
  if(c.pid===undefined)return;
  const p=G.players[c.pid];if(!p)return;
  p.cpu=true;V.toast(`${p.name} が退出したのでCPUに交代します`);V.log(`${p.name} が退出（CPU交代）`);
  for(const rid in NET.pend){const q=NET.pend[rid];if(q.pid===c.pid)resolvePend(rid,q.pick)}
  V.hud();
}

/* ---------- ロビー ---------- */
const $ol=id=>$('#'+id);
function olMsg(t){$ol('olMsg').textContent=t||'';$ol('olMsg2').textContent=t||''}
function slotRows(slots,me){
  return slots.map((s,i)=>{
    const tag={host:'ホスト',human:i===me?'あなた':'参加中',open:'CPU（空き）',cpu:'CPU'}[s.kind];
    const nm=s.kind==='open'||s.kind==='cpu'?`CPU ${DEF_NAME[i]}`:esc(s.name);
    return `<div class="slotrow"><span class="dot" style="background:${hex(PCOL[i])}"></span><b>${nm}</b><span class="tag" style="background:${s.kind==='human'||s.kind==='host'?'#bdf0c9':'#eee'}">${tag}</span></div>`;
  }).join('');
}
function lobbyUpdate(){
  if(!NET.isHost)return;
  $ol('olSlots').innerHTML=slotRows(NET.slots,0);
  const joined=NET.slots.filter(s=>s.kind==='human'||s.kind==='host').length;
  $ol('olCtl').innerHTML=`<div class="prow" style="justify-content:center"><span>人数</span><button class="alt" id="olMinus">−</button><b id="olN">${NET.slots.length}</b><button class="alt" id="olPlus">＋</button></div><button id="olStart" class="pink" style="width:100%;margin-top:6px;font-size:1.1rem">この人数でスタート（空きはCPU）</button>`;
  $ol('olMinus').onclick=()=>{if(NET.slots.length>Math.max(2,NET.slots.reduce((m,s,i)=>(s.kind==='human'?i+1:m),1))){NET.slots.pop();lobbyUpdate()}};
  $ol('olPlus').onclick=()=>{if(NET.slots.length<6){NET.slots.push({kind:'open',name:''});lobbyUpdate()}};
  $ol('olStart').onclick=hostStart;
  olMsg(`参加者 ${joined}人（ホスト含む）。他の人にコード ${NET.code} を伝えてください。`);
  const lob={t:'lobby',slots:NET.slots};NET.conns.forEach(c=>{if(c.slot)sendTo(c,{...lob,me:c.slot})});
}
function showLobby(title){$ol('olMenu').classList.add('hidden');$ol('olLobby').classList.remove('hidden');$ol('olTitle').innerHTML=title}
function openPeer(id){
  return new Promise((res,rej)=>{
    let p;try{p=id?new Peer(id,{config:ICE,debug:0}):new Peer(undefined,{config:ICE,debug:0})}catch(e){rej(e);return}
    p.on('open',()=>res(p));p.on('error',e=>rej(e));
  });
}
async function hostRoom(){
  if(typeof Peer==='undefined'){olMsg('通信ライブラリ(PeerJS)を読み込めませんでした。ネット接続を確認してください。');return}
  NET.name=$ol('olName').value.trim()||'ホスト';
  olMsg('ルームを作っています…');
  let peer=null,code='';
  for(let t=0;t<6&&!peer;t++){
    code=String(100000+rnd(900000));
    try{peer=await openPeer('liferoad-'+code)}catch(e){if(e.type!=='unavailable-id'){olMsg('サーバーに接続できませんでした：'+(e.type||e.message));return}}
  }
  if(!peer){olMsg('ルームを作れませんでした。もう一度お試しください。');return}
  NET.peer=peer;NET.code=code;NET.isHost=true;NET.on=false;NET.started=false;NET.myPid=0;NET.conns=[];
  NET.slots=[{kind:'host',name:NET.name},{kind:'open',name:''},{kind:'open',name:''},{kind:'open',name:''}];
  peer.on('connection',conn=>{
    const c={conn,slot:0,pid:undefined};NET.conns.push(c);
    conn.on('data',m=>hostRecv(c,m));conn.on('close',()=>hostLeft(c));conn.on('error',()=>hostLeft(c));
  });
  peer.on('error',e=>olMsg('通信エラー：'+(e.type||e.message)));
  showLobby(`ルームコード： <span style="font-size:1.8rem;letter-spacing:.15em;color:#ff4f86">${code}</span>`);
  lobbyUpdate();
}
function hostStart(){
  NET.started=true;NET.on=true;
  const list=NET.slots.map((s,i)=>({name:s.kind==='open'||s.kind==='cpu'?DEF_NAME[i]+'(CPU)':s.name,cpu:!(s.kind==='host'||s.kind==='human'),color:PCOL[i]}));
  NET.conns.forEach(c=>{if(c.slot&&NET.slots[c.slot]&&NET.slots[c.slot].kind==='human'){c.pid=c.slot;sendTo(c,{t:'start',list,you:c.slot})}else{c.conn.close()}});
  NET.conns=NET.conns.filter(c=>c.pid!==undefined);
  startGame(list);
}

/* ---------- 参加者 ---------- */
async function joinRoom(){
  if(typeof Peer==='undefined'){olMsg('通信ライブラリ(PeerJS)を読み込めませんでした。ネット接続を確認してください。');return}
  const code=$ol('olCode').value.replace(/\D/g,'');
  if(code.length!==6){olMsg('6桁のルームコードを入れてください');return}
  NET.name=$ol('olName').value.trim()||'ゲスト';
  olMsg('ルームに接続しています…');
  let peer;try{peer=await openPeer()}catch(e){olMsg('サーバーに接続できませんでした：'+(e.type||e.message));return}
  NET.peer=peer;NET.isHost=false;
  const conn=peer.connect('liferoad-'+code,{reliable:true,serialization:'json'});
  NET.hostConn=conn;let opened=false;
  const to=setTimeout(()=>{if(!opened){olMsg('ルームが見つかりません（コードの確認、またはホストの回線を確認）');try{conn.close()}catch(e){}}},12000);
  peer.on('error',e=>{if(e.type==='peer-unavailable'){clearTimeout(to);olMsg('そのコードのルームはありません')}else olMsg('通信エラー：'+(e.type||e.message))});
  conn.on('open',()=>{opened=true;clearTimeout(to);conn.send({t:'join',name:NET.name})});
  conn.on('data',clientRecv);
  conn.on('close',()=>{if(NET.started&&!G.over){cardLocal({head:'接続エラー',color:'#e8454c',title:'ホストとの接続が切れました',text:'ゲームを終了します。',btns:['最初に戻る']},null).then(()=>location.reload())}else if(!NET.started)olMsg('ホストとの接続が切れました')});
}
function applySnap(m){
  G.cur=m.cur;G.turnNo=m.turn;
  m.p.forEach((d,i)=>{if(G.players[i])Object.assign(G.players[i],d)});
  G.awaiting=m.aw>=0?G.players[m.aw]:null;
  layoutAll();V.hud();
}
function clientRecv(m){
  if(!m||typeof m!=='object')return;
  switch(m.t){
    case 'full':olMsg(m.why||'参加できませんでした');try{NET.peer.destroy()}catch(e){}break;
    case 'welcome':showLobby('ルームに参加しました');$ol('olSlots').innerHTML='';$ol('olCtl').innerHTML='';olMsg('ホストがスタートするのを待っています…');break;
    case 'lobby':$ol('olSlots').innerHTML=slotRows(m.slots,m.me);break;
    case 'start':{
      NET.on=true;NET.started=true;NET.myPid=m.you;Sound.resume();
      G.players=m.list.map((o,i)=>newPlayer(i,o.name,o.cpu,o.color));G.cur=0;G.over=false;
      enterGameUI();V.hud();V.banner('LIFE ROAD スタート！');
      break}
    case 'snap':applySnap(m);break;
    case 'ev':{
      const a=m.a||[];
      switch(m.n){
        case 'step':{const p=G.players[a[0]];if(p){p.pos=a[1];V.step(p,a[1])}break}
        case 'bills':V.bills(unPid(a[0]),unPid(a[1]),a[2]);break;
        case 'buildHouse':V.buildHouse(G.players[a[0]],a[1]);break;
        case 'upgradeCar':V.upgradeCar(G.players[a[0]]);break;
        case 'finishCar':V.finishCar(G.players[a[0]]);break;
        case 'confetti':if(a[0])V.confetti(a[0]);break;
        default:if(V[m.n])V[m.n](...a);
      }
      break}
    case 'snd':if(Sound[m.n])Sound[m.n]();break;
    case 'card':{
      const p=G.players[m.pid]||null;
      if(m.rid){cardLocal(m.o,p).then(i=>NET.send({t:'cardAns',rid:m.rid,i}))}
      else cardLocal(m.o,p);
      break}
    case 'cardClose':if(cardCloseFn)cardCloseFn();break;
    case 'spinWait':{
      const p=G.players[NET.myPid];V.waitSpin(p,m.pur,true).then(()=>NET.send({t:'spinGo',rid:m.rid}));break}
    case 'results':V.results();break;
  }
}

/* ---------- タイトル画面のつなぎこみ ---------- */
window.addEventListener('load',()=>{
  $ol('olOpen').onclick=()=>{$('#setupBox').classList.add('hidden');$ol('onlineBox').classList.remove('hidden');olMsg('')};
  $ol('olBack').onclick=()=>{$ol('onlineBox').classList.add('hidden');$('#setupBox').classList.remove('hidden')};
  $ol('olHost').onclick=()=>{Sound.resume();hostRoom()};
  $ol('olJoin').onclick=()=>{Sound.resume();joinRoom()};
  $ol('olLeave').onclick=()=>location.reload();
  const m=location.search.match(/[?&]room=(\d{6})/);      // ?room=123456 で参加画面にコードを入れておく
  if(m){$ol('olOpen').click();$ol('olCode').value=m[1]}
});
