import { parse, QM, ParamType, ParamCritType } from "../lib/qmreader";
import * as fs from "fs";

import { QMPlayer } from "../lib/qmplayer";
import { getAllMediaFromQmm } from "../lib/getAllMediaFromQmm";

/*

for f in *.png; do convert $f -quality 90 $(basename $f .png).jpg; done

for f in *.wav; do ffmpeg -i $f -acodec mp3 -ab 256k $(basename $f .wav).mp3; done


# Generate silence
ffmpeg -f lavfi -i anullsrc=r=11025:cl=mono -t 30 -acodec mp3 Nation.None.mp3

*/

const data = fs.readFileSync(process.argv[2]);

const quest = parse(data);

const media = getAllMediaFromQmm(quest);

console.info(`All images:`);
Object.keys(media.images)
  .sort()
  .forEach((img) => console.info("  " + img));
console.info("");

console.info(`All sounds:`);
Object.keys(media.sounds)
  .sort()
  .forEach((sound) =>
    console.info(
      "  " + sound + "  ",
      //+ media.sounds[sound].join(", ")
    ),
  );
console.info("");

console.info(`All track:`);
Object.keys(media.tracks)
  .sort()
  .forEach((track) =>
    console.info(
      "  " + track + "  ",
      //+ media.tracks[track].join(", ")
    ),
  );
console.info("");
