# LIFE ROAD

ブラウザで遊べる3D人生すごろく（2〜6人・人間/CPU）。`index.html` をブラウザで開くだけで遊べます（Three.js r128 を cdnjs から読み込み）。

- マス190（本線150＋分岐40）、職業22、アイテム20、家7、株10
- 3Dはすべて基本図形で構成、効果音はWeb Audioで合成
- `src/` が分割ソース。`src/build.sh` で `index.html` を再生成（`data.js` は `src/spec.txt` から自動生成）
