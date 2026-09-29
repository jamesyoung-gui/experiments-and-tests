set -e
D=/home/user/experiments-and-tests/pelican-bicycle
node $D/drafts/A-flat/gen.mjs
node $D/tools/render.mjs $D/drafts/A-flat/keyframe.svg $D/drafts/A-flat/keyframe.png 1600 900
node $D/tools/render.mjs $D/drafts/A-flat/closeup.svg $D/drafts/A-flat/closeup.png 1120 1160
