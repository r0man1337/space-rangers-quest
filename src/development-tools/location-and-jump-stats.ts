import { parse, QM, ParamType, ParamCritType } from "../lib/qmreader";
import * as fs from "fs";

import { QMPlayer } from "../lib/qmplayer";

const dataSrcPath = __dirname + "/../../borrowed";

const stats: {
  quest: QM;
  name: string;
}[] = [];

for (const origin of fs.readdirSync(dataSrcPath + "/qm")) {
  console.info(`Scanning origin ${origin}`);
  const qmDir = dataSrcPath + "/qm/" + origin + "/";
  for (const qmShortName of fs.readdirSync(qmDir)) {
    const srcQmName = qmDir + qmShortName;
    const lang = origin.endsWith("eng") ? "eng" : "rus";
    const oldTge = origin.startsWith("Tge");
    const gameName = qmShortName.replace(/(\.qm|\.qmm)$/, "").replace(/_eng$/, "");
    console.info(`Reading ${qmShortName} (${lang}, oldTge=${oldTge}) gameName=${gameName}`);

    const data = fs.readFileSync(srcQmName);

    const quest = parse(data);

    stats.push({
      name: srcQmName,
      quest,
    });
    //const player = new QMPlayer(quest, undefined, lang, oldTge);
    //player.start();
  }
}

console.info("===========================");

stats
  //.sort((a, b) => a.quest.locations.length - b.quest.locations.length)
  .sort((a, b) => a.quest.jumps.length - b.quest.jumps.length)
  .forEach((stat) => {
    console.info(
      `${stat.name} loc=${stat.quest.locations.length} jumps=${stat.quest.jumps.length}`,
    );
  });
