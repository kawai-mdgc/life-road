// ===== 予備の経路（中継）：P2Pで直接つながらない人のための、公開MQTTブローカー経由の通信 =====
// ・ホストはルームを作った時点から、複数のブローカーで待ち受ける
// ・参加者は、直接つながらなかったときだけ、つながるブローカーを探してホストに届ける
// ・公開ブローカーは誰でも傍受できるので、参加時にECDHで鍵を交換し、以後の中身はすべてAES-GCMで暗号化する
// ・PeerJSのDataConnectionと同じ使い方（send / on('open'|'data'|'close') / open / close）ができるようにしてある
const RELAY_BROKERS=[
  {url:'wss://public.cloud.shiftr.io:443/mqtt',user:'public',pass:'public'},   // 443番：会社のネットワークでも通りやすい
  {url:'wss://broker.emqx.io:8084/mqtt'},
  {url:'wss://broker.hivemq.com:8884/mqtt'}
];
const RELAY_CHUNK=48000,RELAY_GAP=70,RELAY_PING=5000,RELAY_DEAD=30000;   // 分割は大きめ・送信は間隔をあける（公開サーバーの流量制限に当たらないように）
const rwait=ms=>new Promise(r=>setTimeout(r,ms));
const relayOK=()=>typeof Paho!=='undefined'&&!!(window.crypto&&crypto.subtle);
const rb64=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)};
const rub64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
const ECDH={name:'ECDH',namedCurve:'P-256'};
async function relayKeyPair(){const kp=await crypto.subtle.generateKey(ECDH,false,['deriveKey']);return{kp,pub:rb64(new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey)))}}
async function relayDerive(kp,peerPub){const pk=await crypto.subtle.importKey('raw',rub64(peerPub),ECDH,false,[]);return crypto.subtle.deriveKey({name:'ECDH',public:pk},kp.privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
function relayOpenBroker(b,will){                          // ブローカーに接続（つながったら client を返す）
  return new Promise((res,rej)=>{
    let c;try{c=new Paho.Client(b.url,'lr'+Math.random().toString(36).slice(2,12))}catch(e){rej(e);return}
    const o={timeout:7,keepAliveInterval:20,cleanSession:true,mqttVersion:4,onSuccess:()=>res(c),onFailure:e=>rej(e)};
    if(b.user){o.userName=b.user;o.password=b.pass}
    if(will){const m=new Paho.Message(will.payload);m.destinationName=will.topic;m.qos=0;o.willMessage=m}
    try{c.connect(o)}catch(e){rej(e)}
  });
}
class RelayConn{                                            // 1対1の通り道（暗号化・分割・順番の保証・生存確認つき）
  constructor(client,outTopic,cid){this.client=client;this.out=outTopic;this.cid=cid;this.relay=true;this.open=false;this.key=null;this.h={};this.sq=Promise.resolve();this.rq=Promise.resolve();
    this.n=0;this.expect=1;this.parts={};this.seen=Date.now();this.timer=null}
  on(ev,fn){(this.h[ev]=this.h[ev]||[]).push(fn);return this}
  emit(ev,a){(this.h[ev]||[]).forEach(f=>{try{f(a)}catch(e){console.warn('relay handler',e)}})}
  raw(o){o.cid=this.cid;try{const m=new Paho.Message(JSON.stringify(o));m.destinationName=this.out;m.qos=1;this.client.send(m)}catch(e){this._close()}}
  ready(key){this.key=key;this.open=true;this.seen=Date.now();
    this.timer=setInterval(()=>{if(!this.open)return;this.raw({k:'p'});if(Date.now()-this.seen>RELAY_DEAD)this._close()},RELAY_PING);this.emit('open')}
  send(obj){if(!this.open)return;                           // 暗号化 → 分割して送る（順番を守るため直列に処理）
    this.sq=this.sq.then(async()=>{
      const iv=crypto.getRandomValues(new Uint8Array(12)),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},this.key,new TextEncoder().encode(JSON.stringify(obj))));
      const all=new Uint8Array(12+ct.length);all.set(iv);all.set(ct,12);const s=rb64(all),t=Math.ceil(s.length/RELAY_CHUNK)||1,n=++this.n;
      for(let i=0;i<t;i++){this.raw({k:'m',n,i,t,d:s.slice(i*RELAY_CHUNK,(i+1)*RELAY_CHUNK)});if(t>1)await rwait(RELAY_GAP*2)}                // ふつうの小さな通信は待たない（待つのは分割した大きなデータだけ）
    }).catch(e=>console.warn('relay send',e));
  }
  recv(o){this.seen=Date.now();                             // 受け取り：分割をまとめ、番号順に復号して渡す
    if(o.k==='bye'){this._close();return}
    if(o.k!=='m'||!this.key||o.n<this.expect)return;
    const p=this.parts[o.n]||(this.parts[o.n]={t:o.t,got:0,d:[]});if(p.d[o.i]===undefined){p.d[o.i]=o.d;p.got++}
    this.rq=this.rq.then(async()=>{
      for(;;){const q=this.parts[this.expect];if(!q||q.got<q.t)break;delete this.parts[this.expect];this.expect++;
        const all=rub64(q.d.join('')),pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:all.subarray(0,12)},this.key,all.subarray(12));
        this.emit('data',JSON.parse(new TextDecoder().decode(pt)))}
    }).catch(e=>console.warn('relay recv',e));
  }
  close(){if(this.open)this.raw({k:'bye'});this._close()}
  _close(){if(this.closed)return;this.closed=true;this.open=false;clearInterval(this.timer);this.emit('close')}
}
/* ---------- ホスト：全ブローカーで待ち受ける ---------- */
const RelayHost={clients:[],conns:{}};
function relayHostStart(code,onConn){
  if(!relayOK())return;
  const base=`liferoad1/${code}`;
  RELAY_BROKERS.forEach((b,bi)=>{
    relayOpenBroker(b).then(client=>{
      RelayHost.clients.push(client);
      client.onMessageArrived=async m=>{
        let o;try{o=JSON.parse(m.payloadString)}catch(e){return}
        if(!o||typeof o.cid!=='string'||o.cid.length>40)return;
        const id=bi+':'+o.cid;let rc=RelayHost.conns[id];
        if(o.k==='hello'&&typeof o.pub==='string'){
          if(rc&&!rc.closed)return;                         // 同じ人の重複した呼びかけは無視
          rc=RelayHost.conns[id]=new RelayConn(client,`${base}/c/${o.cid}`,o.cid);
          try{const me=await relayKeyPair(),key=await relayDerive(me.kp,o.pub);rc.raw({k:'welcome',pub:me.pub});onConn(rc);rc.ready(key)}catch(e){console.warn('relay kx',e)}
          return;
        }
        if(rc)rc.recv(o);
      };
      client.onConnectionLost=()=>{Object.keys(RelayHost.conns).forEach(id=>{if(id.startsWith(bi+':'))RelayHost.conns[id]._close()})};
      client.subscribe(`${base}/h`,{qos:1});
    }).catch(e=>console.warn('relay broker unavailable',b.url));
  });
}
/* ---------- 参加者：つながるブローカーを順に試して、ホストに届ける ---------- */
async function relayJoin(code,note){
  if(!relayOK())throw new Error('relay unsupported');
  const base=`liferoad1/${code}`,cid=Math.random().toString(36).slice(2,12)+Date.now().toString(36);
  for(const b of RELAY_BROKERS){
    let client;try{client=await relayOpenBroker(b,{topic:`${base}/h`,payload:JSON.stringify({k:'bye',cid})})}catch(e){continue}
    if(note)note();
    const rc=new RelayConn(client,`${base}/h`,cid),me=await relayKeyPair();
    const ok=await new Promise(res=>{
      const to=setTimeout(()=>res(false),6000);
      client.onMessageArrived=async m=>{let o;try{o=JSON.parse(m.payloadString)}catch(e){return}
        if(o.k==='welcome'&&!rc.key&&typeof o.pub==='string'){clearTimeout(to);try{const key=await relayDerive(me.kp,o.pub);res(key)}catch(e){res(false)}return}
        rc.recv(o)};
      client.onConnectionLost=()=>rc._close();
      client.subscribe(`${base}/c/${cid}`,{qos:1,onSuccess:()=>rc.raw({k:'hello',pub:me.pub}),onFailure:()=>{clearTimeout(to);res(false)}});
    });
    if(ok){rc._key=ok;return rc}                             // ホストがこのブローカーで応えた
    try{client.disconnect()}catch(e){}
  }
  throw new Error('no relay');
}
