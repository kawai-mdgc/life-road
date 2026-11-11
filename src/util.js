// ===== 共通ユーティリティ & 効果音（Web Audio API で合成） =====
const $=s=>document.querySelector(s);
const AUTO=/[?&]auto=1/.test(location.search);       // テスト用：全員CPUで高速に通しプレイ
let SPD=AUTO?60:1;                                     // 演出スピード倍率
const sleep=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms/SPD)));
const fmt=n=>(n<0?'−':'')+Math.abs(Math.round(n)).toLocaleString('en-US');
const TestMode={on:false,roll:0};                  // テストモード（ホストが待機ルームでオンにしたときだけ有効）
const rnd=n=>Math.floor(Math.random()*n);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const yen=s=>String(s).replace(/(\d{1,3}(?:,\d{3})+)(?![\d,]|円)/g,'$1円');   // 文章中の金額に「円」を付ける
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const Sound=(()=>{
  let ctx=null,master=null,on=true;
  function init(){
    if(ctx||AUTO)return;
    try{ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.5;master.connect(ctx.destination)}catch(e){ctx=null}
  }
  function resume(){init();if(ctx&&ctx.state==='suspended')ctx.resume()}
  function tone(f,t0,dur,type='sine',vol=.25,f2=null){
    if(!ctx||!on)return;
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(f,ctx.currentTime+t0);
    if(f2)o.frequency.exponentialRampToValueAtTime(f2,ctx.currentTime+t0+dur);
    g.gain.setValueAtTime(0.0001,ctx.currentTime+t0);
    g.gain.exponentialRampToValueAtTime(vol,ctx.currentTime+t0+.01);
    g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+t0+dur);
    o.connect(g);g.connect(master);o.start(ctx.currentTime+t0);o.stop(ctx.currentTime+t0+dur+.05);
  }
  function noise(t0,dur,vol=.15,hp=2000){
    if(!ctx||!on)return;
    const n=Math.floor(ctx.sampleRate*dur),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=ctx.createBufferSource();s.buffer=buf;
    const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=hp;
    const g=ctx.createGain();g.gain.value=vol;
    s.connect(f);f.connect(g);g.connect(master);s.start(ctx.currentTime+t0);
  }
  return{
    resume,
    get on(){return on},
    toggle(){on=!on;return on},
    tick(){tone(1400,0,.04,'square',.12)},                 // ルーレットのカチカチ
    step(){tone(220,0,.05,'triangle',.12,160)},            // 車の走行
    coin(){tone(1320,0,.08,'square',.12);tone(1760,.07,.18,'square',.12)},   // チャリン
    bill(){noise(0,.18,.12,3000)},                          // お札のひらひら
    good(){[523,659,784,1046].forEach((f,i)=>tone(f,i*.08,.18,'triangle',.2))},
    bad(){tone(220,0,.25,'sawtooth',.18,110);tone(165,.2,.3,'sawtooth',.18,82)},
    pop(){tone(300,0,.15,'sine',.25,900)},
    stamp(){tone(110,0,.12,'square',.3,55);noise(0,.08,.2,500)},
    stopSq(){tone(660,0,.1,'triangle',.2);tone(880,.1,.18,'triangle',.2)},
    click(){tone(900,0,.05,'sine',.15)},
    fanfare(){[523,523,523,659,784,1046].forEach((f,i)=>tone(f,i*.13,.22,'square',.15));tone(1318,.9,.6,'triangle',.2)},
    rumble(){tone(70,0,.5,'sawtooth',.16,50);tone(95,.35,.5,'sawtooth',.14,60)},      // 取り立て屋のエンジン音
    boom(){tone(95,0,.4,'sine',.5,38);tone(60,.05,.5,'triangle',.35,30);noise(0,.45,.22,250)},     // 家が立つ「ボン！！」
    siren(){[0,.3,.6,.9].forEach((t,i)=>tone(i%2?720:980,t,.28,'square',.1))},      // パトカーのサイレン
    spinStop(){tone(880,0,.12,'triangle',.25);tone(1175,.1,.3,'triangle',.25)}
  };
})();
