#!/bin/sh
# regenerate + render keyframe and close-up
D=/home/user/experiments-and-tests/pelican-bicycle/drafts/C-poster
T=/home/user/experiments-and-tests/pelican-bicycle/tools/render.mjs
node $D/gen.mjs && node $T $D/keyframe.svg $D/keyframe.png 1600 900 && node $T $D/closeup.svg $D/closeup.png 1120 1160
