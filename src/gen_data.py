# 設定書(spec.txt)の表から data.js を機械的に生成する（1行も省略しないため）
import json,re,os
D=os.path.dirname(os.path.abspath(__file__))
L=open(os.path.join(D,'spec.txt'),encoding='utf-8').read().split('\n')
route='main'; sec=''; sq=[]; jobs=[]; items=[]; houses=[]
AB={'会社員':'promo2','販売員':'half_item','コック':'family3','美容師':'wed5','大工':'carp','バス運転手':'void_car','農家':'farm','警察官':'void_scam','消防士':'void_fire','保育士':'baby3','動画配信者':'stream',
'医者':'doc','弁護士':'law','パイロット':'travel','エンジニア':'patent','教師':'teach','研究者':'research','建築家':'arch','獣医':'vet','ゲームクリエイター':'gamer','プロスポーツ選手':'athlete','宇宙飛行士':'astro'}
IT={'健康保険':'health','自動車保険':'car','火災保険':'fire','セキュリティソフト':'sec','ターボチケット':'turbo','ラッキーコイン':'coin','バックギア':'back','おやすみ免除券':'nap','割引クーポン':'coupon','お祝いブースター':'boost','職業交換チケット':'swap','宝の地図':'map','銀行の金庫カギ':'key','金の腕時計':'watch','宝石のネックレス':'neck','ヴィンテージカー':'vcar','名画':'paint','古いつぼ':'vase','サイン入りボール':'ball','盆栽':'bonsai'}
def num(s):
    m=re.search(r'[\d,]+',s); return int(m.group().replace(',','')) if m else 0
def money(m):
    m=m.replace('−','-').replace('＋','+')
    r=re.match(r'^([+\-]?)([\d,]+)(?:×(人数|子ども|孫|ピン|株券))?$',m.strip())
    if not r: return None,None
    a=int(r.group(2).replace(',',''));
    if r.group(1)=='-': a=-a
    return a,{'人数':'others','子ども':'kids','孫':'grand','ピン':'pins','株券':'stocks'}.get(r.group(3))
for ln in L:
    if ln.startswith('### '):
        h=ln[4:]
        if h.startswith('第'): route='main'
        elif '大学' in h: route='U'
        elif '就職ルート' in h: route='W'
        elif '安定' in h: route='S'
        elif '挑戦ルート' in h: route='R'
        sec=h; continue
    if ln.startswith('## '): sec=ln[3:]; continue
    if ' | ' not in ln: continue
    c=[x.strip() for x in ln.split(' | ')]
    if c[0] in('マス','職業','アイテム','家','金額（LD）','色','項目','種類','アセット'): continue
    if len(c)==4 and (re.match(r'^(\d+|[UWSR]\d+)$',c[0])) and ('章' in ''.join(L) ):
        col=c[1]; k=''
        if col.startswith('金'): cc='gold'
        elif col=='黄': cc='yellow'
        elif col=='緑': cc='green'
        elif col=='赤': cc='red'
        else:
            cc='blue'; k={'青・アイテム':'item','青・勝負':'duel','青・家族':'family','青・職業':'job'}.get(col,'event')
        a,x=money(c[3])
        sq.append({'id':c[0],'r':route,'n':int(re.sub(r'\D','',c[0])),'c':cc,'k':k,'t':c[2],'m':c[3],'a':a,'x':x}); continue
    if sec in('一般職','専門職') and len(c)==4:
        jobs.append({'n':c[0],'sal':num(c[1]),'ab':AB[c[0]],'abt':c[2],'look':c[3],'deck':'g' if sec=='一般職' else 's'}); continue
    if sec.startswith('アイテムカード') and len(c)==4:
        ty={'保険':'ins','使い切り':'use','コレクション':'col'}[c[1]]
        items.append({'n':c[0],'ty':ty,'c':IT[c[0]],'eff':c[2],'v':c[3],'val':num(c[3])}); continue
    if sec.startswith('家カード') and len(c)==4:
        houses.append({'n':c[0],'price':num(c[1]),'sell':(num(c[2]) if '回して' not in c[2] else 'roll25'),'sellt':c[2],'look':c[3]}); continue
out='// ===== 自動生成: 設定書の表をそのままデータ化（省略なし） =====\n'
out+='const SQDATA=[\n'+',\n'.join(json.dumps(s,ensure_ascii=False) for s in sq)+'\n];\n'
out+='const JOBS=[\n'+',\n'.join(json.dumps(s,ensure_ascii=False) for s in jobs)+'\n];\n'
out+='const ITEMS=[\n'+',\n'.join(json.dumps(s,ensure_ascii=False) for s in items)+'\n];\n'
out+='const HOUSES=[\n'+',\n'.join(json.dumps(s,ensure_ascii=False) for s in houses)+'\n];\n'
out+='const STOCKS=[1,2,3,4,5,6,7,8,9,10].map(n=>({n,face:10000,div:5000}));\n'
open(os.path.join(D,'data.js'),'w',encoding='utf-8').write(out)
from collections import Counter
cnt=Counter(s['r'] for s in sq)
print('squares',len(sq),dict(cnt),'jobs',len(jobs),'items',len(items),'houses',len(houses))
