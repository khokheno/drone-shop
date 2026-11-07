#!/bin/sh
# Stamps every local .js/.css reference with ?v=<time> so browsers fetch a matching set after each deploy
# (GitHub Pages lets browsers reuse files for 10 minutes, and a new page with an old script breaks).
# Run before committing a change to the site: sh tools/stamp.sh
cd "$(dirname "$0")/.." || exit 1
V=$(date +%Y%m%d%H%M%S)
perl -pi -e 's{((?:src|href)="(?!https?:)[^"]+\.(?:js|css))(?:\?v=\w+)?"}{$1?v='"$V"'"}g' index.html admin/index.html
perl -pi -e 's{(from "\./[\w-]+\.js)(?:\?v=\w+)?"}{$1?v='"$V"'"}g' assets/*.js
echo "stamped v=$V"
