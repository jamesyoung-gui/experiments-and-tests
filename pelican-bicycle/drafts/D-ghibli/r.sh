#!/bin/sh
cd /home/user/experiments-and-tests/pelican-bicycle
node drafts/D-ghibli/gen.mjs && \
node tools/render.mjs drafts/D-ghibli/keyframe.svg drafts/D-ghibli/keyframe.png 1600 900 && \
node tools/render.mjs drafts/D-ghibli/closeup.svg drafts/D-ghibli/closeup.png 1120 1160
