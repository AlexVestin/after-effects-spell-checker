#! /bin/bash

set -eo pipefail

yarn run api-extractor run 
yarn run api-documenter markdown -i temp

rm -r html || true
mkdir html || true

echo Rendering HTML...

for file in ./markdown/*.md
do 
  BASE=$(basename $file .md)
  pandoc $file -o html/$BASE.html
  perl -pi -e 's/"\K([^"]+)\.md(?=")/\1.html/g' html/$BASE.html

  echo '<link rel="stylesheet" href="https://unpkg.com/mvp.css">' >> html/$BASE.html
done

rm -r ../web/static/docs/harperjs || true
mkdir -p ../web/static/docs/harperjs || true
mv -f html ../web/static/docs/harperjs/ref 
