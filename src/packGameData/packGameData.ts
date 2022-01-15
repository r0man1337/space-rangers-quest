import { parse, QM, ParamType, ParamCritType, getImagesListFromQmm } from "../lib/qmreader";

import * as pako from "pako";
import * as fs from "fs";

import { QMPlayer } from "../lib/qmplayer";
import { PQImages } from "../lib/pqImages";
import { readPqi } from "./pqi";
import { Index, Game, PQIParsed } from "./defs";
import { scanAndCopyImages } from "./images";
import { scanAndCopyMusic } from "./music";
import { DEBUG_SPEEDUP_SKIP_COPING } from "./flags";
import { Quest } from "../lib/qmplayer/funcs";
import { writeQmm } from "../lib/qmwriter";

/*

This script prepares data and build index.json file

Data is copied from borrowed folder into build-web/data and modified if needed
 - copy music
 - copy images and change filename to lowercase
 - copy qm/qmm and re-save them as qmm with images and compress into .gz
 - write index.json




TODO to test:
  - SR1 quests have images
    - location
    - jumps
    - critParams
    - example quest Boat:
      - location id = 1
      - jumps P11 or others
      - Param 1 or param 2
  - SR2 quests have images
    - example Ministry:
      - starting ID=121
      - Param 1
    - example Player
      - Jump 12
  - SR2 eng quests have images
    - same examples as above

Check English have eng quests origin


*/

const warns: string[] = [];

const dataSrcPath = __dirname + "/../../borrowed";
const dataDstPath = __dirname + "/../../built-web/data";

const resultJsonFile = dataDstPath + "/index.json";

console.info(`Creating destination folders`);
if (!fs.existsSync(dataDstPath)) {
  fs.mkdirSync(dataDstPath);
}
for (const d of ["img", "qm", "music"]) {
  if (!fs.existsSync(dataDstPath + "/" + d)) {
    fs.mkdirSync(dataDstPath + "/" + d);
  }
}

const index: Index = {
  quests: [],
  dir: {
    quests: { files: [], totalSize: 0 },
    images: { files: [], totalSize: 0 },
    music: { files: [], totalSize: 0 },
  },
};

const allImages = scanAndCopyImages(dataSrcPath, dataDstPath, index);

scanAndCopyMusic(dataSrcPath, dataDstPath, index);

const pqiSR1Parsed = JSON.parse(
  fs.readFileSync(__dirname + "/../../src/sr1-pqi.json").toString(),
) as PQIParsed;

const pqiSR2Parsed = readPqi(dataSrcPath + "/PQI.txt", dataSrcPath, warns);
console.info(`Found ${Object.keys(pqiSR2Parsed).length} quests in PQI.txt`);

console.info(`Scanning quests`);
const seenQuests: string[] = [];
for (const origin of fs.readdirSync(dataSrcPath + "/qm")) {
  console.info(`\n\nScanning origin ${origin}`);
  const qmDir = dataSrcPath + "/qm/" + origin + "/";
  for (const qmShortName of fs.readdirSync(qmDir)) {
    if (seenQuests.indexOf(qmShortName) > -1) {
      throw new Error(`Duplicate file ${qmShortName}. Please rename it!`);
    } else {
      seenQuests.push(qmShortName);
    }
    const srcQmName = qmDir + qmShortName;

    const gameName = qmShortName.replace(/(\.qm|\.qmm)$/, "");
    const lang = gameName.endsWith("_eng") ? "eng" : "rus";
    console.info(`Reading ${srcQmName} (lang=${lang} gameName=${gameName}`);

    const srcQmQmmBuffer = fs.readFileSync(srcQmName);

    const quest = parse(srcQmQmmBuffer);

    // Why do we need to do this?
    const player = new QMPlayer(quest, "rus");
    player.start();

    const qmmImagesList = getImagesListFromQmm(quest);

    // This will be initial buffer or repacked quest, depending if original have images or not
    let outputQmmBuffer: Buffer | undefined = undefined;

    // If quest have images then do nothing
    if (qmmImagesList.length > 0) {
      outputQmmBuffer = srcQmQmmBuffer;
      for (const qmmImage of qmmImagesList) {
        if (allImages.indexOf(qmmImage.toLowerCase() + ".jpg") < 0) {
          warns.push(
            `Image ${qmmImage} is from QMM for ${qmShortName}, ` + `but not found in img dir`,
          );
        }
      }
    } else {
      // Else lets checkout PQIs
      const pqi2ImagesData = pqiSR2Parsed[gameName.toLowerCase()];
      const pqi1ImagesData = pqiSR1Parsed[gameName];

      const pqiImagesData = pqi2ImagesData || pqi1ImagesData;
      if (pqiImagesData) {
        const updatedQuest: Quest = {
          ...quest,
          locations: quest.locations.map((l) => {
            const imageFromPQI = pqiImagesData.find((pqiImage) =>
              pqiImage.locationIds?.includes(l.id),
            );
            return {
              ...l,
              media: l.media.map((m) => ({
                ...m,
                img: imageFromPQI?.filename,
              })),
            };
          }),
          jumps: quest.jumps.map((j) => {
            const imageFromPQI = pqiImagesData.find((pqiImage) => pqiImage.jumpIds?.includes(j.id));
            return {
              ...j,
              img: imageFromPQI?.filename,
            };
          }),
          params: quest.params.map((p, paramIndex) => {
            const stParamId = paramIndex + 1;
            const imageFromPQI = pqiImagesData.find((pqiImage) =>
              pqiImage.critParams?.includes(stParamId),
            );
            if (imageFromPQI && p.type === ParamType.Обычный) {
              warns.push(
                `Quest ${qmShortName} has image for param p${stParamId} in PQI but param is not critical!`,
              );
              return p;
            }
            return {
              ...p,
              img: imageFromPQI?.filename,
            };
          }),
        };
        outputQmmBuffer = writeQmm(updatedQuest);
      } else {
        // No PQI, no images from QMM. Maybe donor exists?

        let donorQuestRaw: Buffer | null = null;
        const donorQmShortName =
          lang === "eng" ? qmShortName.replace("_eng.", ".").replace(/.qm$/, ".qmm") : null;

        if (donorQmShortName) {
          for (const donorOrigin of fs.readdirSync(dataSrcPath + "/qm")) {
            const donorQmDir = dataSrcPath + "/qm/" + donorOrigin + "/";

            const donorFullQmName = donorQmDir + donorQmShortName;
            if (fs.existsSync(donorFullQmName)) {
              donorQuestRaw = fs.readFileSync(donorFullQmName);
              break;
            }
          }
        }

        if (donorQuestRaw) {
          const donorQuest = parse(donorQuestRaw);

          const donorWarns: string[] = [];

          const updatedQuest: Quest = {
            ...quest,
            locations: quest.locations.map((l) => {
              const donorLocation = donorQuest.locations.find((dl) => dl.id === l.id);
              if (!donorLocation) {
                donorWarns.push(`L${l.id} is not found in donor quest`);
              }
              return {
                ...l,
                media: l.media.map((srcMedia, srcMediaIndex) => {
                  if (!l.texts[srcMediaIndex]) {
                    return srcMedia;
                  }

                  if (donorLocation && !donorLocation.media[srcMediaIndex]) {
                    donorWarns.push(`L${l.id}-M${srcMediaIndex} is not found in donor quest`);
                  }
                  return {
                    ...srcMedia,
                    img: donorLocation?.media[srcMediaIndex]?.img,
                  };
                }),

                paramsChanges: l.paramsChanges.map((paramChange, srcParamChangeIndex) => {
                  if (!quest.params[srcParamChangeIndex].active) {
                    return paramChange;
                  }
                  if (donorLocation && !donorLocation.paramsChanges[srcParamChangeIndex]) {
                    donorWarns.push(
                      `L${l.id}-PC${srcParamChangeIndex} is not found in donor quest`,
                    );
                  }
                  return {
                    ...paramChange,
                    img: donorLocation?.paramsChanges[srcParamChangeIndex]?.img,
                  };
                }),
              };
            }),
            jumps: quest.jumps.map((j) => {
              const donorJump = donorQuest.jumps.find((dj) => dj.id === j.id);
              if (!donorJump) {
                donorWarns.push(`J${j.id} is not found in donor quest`);
              }
              return {
                ...j,
                img: donorJump?.img,
                paramsChanges: j.paramsChanges.map((paramChange, srcParamChangeIndex) => {
                  if (!quest.params[srcParamChangeIndex].active) {
                    return paramChange;
                  }

                  if (donorJump && !donorJump.paramsChanges[srcParamChangeIndex]) {
                    donorWarns.push(
                      `J${j.id}-PC${srcParamChangeIndex} is not found in donor quest`,
                    );
                  }
                  return {
                    ...paramChange,
                    img: donorJump?.paramsChanges[srcParamChangeIndex]?.img,
                  };
                }),
              };
            }),
            params: quest.params.map((p, paramIndex) => {
              if (!quest.params[paramIndex].active) {
                return p;
              }

              const donorParam = donorQuest.params[paramIndex];
              if (!donorParam) {
                donorWarns.push(`P${paramIndex} is not found in donor quest`);
              }
              return {
                ...p,
                img: donorParam?.img,
              };
            }),
          };
          outputQmmBuffer = writeQmm(updatedQuest);

          if (donorWarns.length > 0) {
            warns.push(`Donor for ${qmShortName} has warnings: ${donorWarns.join(", ")}`);
          }
        } else {
          warns.push(`Not possible to find any images for ${qmShortName}!`);
          outputQmmBuffer = srcQmQmmBuffer;
        }
      }
    }

    // tslint:disable-next-line:strict-type-predicates
    if (!outputQmmBuffer) {
      throw new Error(`Internal error, outputQmmBuffer must always be set`);
    }

    fs.writeFileSync(
      dataDstPath + "/qm/" + qmShortName + ".gz",
      Buffer.from(pako.gzip(outputQmmBuffer)),
    );

    const gameFilePath = "qm/" + qmShortName + ".gz";
    const game: Game = {
      filename: gameFilePath,
      taskText: quest.taskText,
      smallDescription:
        lang === "rus"
          ? `Сложность: ${quest.hardness}, из ${origin}`
          : `Hardness: ${quest.hardness}, from ${origin}`,
      gameName,
      hardness: quest.hardness,
      questOrigin: origin,
      lang,
    };

    index.quests.push(game);

    const gzFileSize = fs.statSync(dataDstPath + "/qm/" + qmShortName + ".gz").size;
    index.dir.quests.files.push({
      path: gameFilePath,
      size: gzFileSize,
    });
    index.dir.quests.totalSize += gzFileSize;
  }
}

index.quests = index.quests.sort(
  (a, b) => a.hardness - b.hardness || (a.gameName > b.gameName ? 1 : -1),
);
console.info(`Done read, writing result into ${resultJsonFile}`);
fs.writeFileSync(resultJsonFile, JSON.stringify(index));

if (warns.length === 0) {
  console.info("\n\nAll done, no warnings");
} else {
  console.info(`\n\nDone with warnings:\n\n${warns.join("\n")}`);
}
