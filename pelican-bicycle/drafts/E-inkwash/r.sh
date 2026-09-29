#!/bin/sh
# regenerate + render keyframe and close-up
cd "$(dirname "$0")"
node gen.mjs || exit 1
node ../../tools/render.mjs keyframe.svg keyframe.png 1600 900 &&
node ../../tools/render.mjs closeup.svg closeup.png 1120 1160
