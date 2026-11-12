#!/bin/sh
# 分割ソースを1つのHTMLに結合する（成果物は ../index.html のみで完結）
cd "$(dirname "$0")"
python3 -I gen_data.py >/dev/null
cat util.js data.js rules.js world1.js world2.js world3.js ui.js relay.js net.js test.js > all.js
cat head.html all.js > ../index.html
printf '\n</script>\n</body>\n</html>\n' >> ../index.html
echo "built: $(wc -c < ../index.html) bytes"
