#!/bin/sh
# crop.sh x y w h scale out.png : render a zoomed crop of keyframe.svg
D=/home/user/experiments-and-tests/pelican-bicycle/drafts/C-poster
S=/tmp/claude-0/-home-user-experiments-and-tests/3f69ebf3-ead2-58f4-98cd-dbffaeca592a/scratchpad
mkdir -p $S
W=$(echo "$3*$5" | bc); H=$(echo "$4*$5" | bc)
sed "s|viewBox=\"0 0 1600 900\" width=\"1600\" height=\"900\"|viewBox=\"$1 $2 $3 $4\" width=\"$W\" height=\"$H\"|" $D/keyframe.svg > $S/crop.svg
node /home/user/experiments-and-tests/pelican-bicycle/tools/render.mjs $S/crop.svg $S/$6 $W $H
