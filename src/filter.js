"use strict";

const fr = require("face-recognition");
const LOG = require("winston");
const fs = require("fs-extra");
const sharp = require("sharp");
const inquirer = require("inquirer");
const walk = require("klaw");
const path = require("path");
const async = require("async");
const imageSize = require("image-size");

const IMG_WIDTH = 1500;
const TMP_FILE = "__tmp__";
const SHIN_DIR = "shin";
const FAMILY_DIR = "family";
const OTHERS_DIR = "others";
const FAILED_DIR = "failed";
const QUALITY = 0.7;

module.exports = async function() {
    const { src, dst } = await inquirer.prompt([{
        type: "input",
        name: "src",
        message: "source?"
    }, {
        type: "input",
        name: "dst",
        message: "destination?"
    }]);

    LOG.info("Init directories...");
    const dirShin = path.join(dst, SHIN_DIR);
    const dirFamily = path.join(dst, FAMILY_DIR);
    const dirOthers = path.join(dst, OTHERS_DIR);
    const dirFailed = path.join(dst, FAILED_DIR);
    fs.ensureDirSync(dirShin);
    fs.ensureDirSync(dirFamily);
    fs.ensureDirSync(dirOthers);
    fs.ensureDirSync(dirFailed);

    LOG.info("Load model...");
    const detector = fr.FaceDetector();
    const recognizer = fr.FaceRecognizer();
    recognizer.load(JSON.parse(fs.readFileSync("model.json").toString()));
    LOG.info("Model loaded.");

    return new Promise((resolve, reject) => {
        const tasks = [];
        walk(src)
            .on("data", item => {
                const pathInfo = path.parse(item.path);
                if (item.stats.isFile() && !pathInfo.base.startsWith(".")) {
                    tasks.push(done => {
                        LOG.info(`Process ${item.path}`);

                        const move = destination => {
                            LOG.info(`    Move to ${destination}...`);
                            fs.moveSync(item.path, path.join(destination, pathInfo.base));
                        };

                        const moveToOthers = () => {
                            move(dirOthers);
                        };

                        const moveToShin = () => {
                            move(dirShin);
                        };

                        const moveToFamily = () => {
                            move(dirFamily);
                        };

                        const moveToFailed = () => {
                            move(dirFailed);
                        };

                        const tmpFile = `${TMP_FILE}${pathInfo.ext}`;
                        let width = Number.MAX_SAFE_INTEGER;
                        try {
                            width = imageSize(item.path).width;
                        } catch (e) {
                            LOG.info("    May not bee an image?");
                        }
                        sharp(item.path)
                            .resize(Math.min(IMG_WIDTH, width))
                            .toFile(tmpFile)
                            .then(() => {
                                const faces = detector.detectFaces(fr.loadImage(tmpFile));
                                if (faces.length === 0) {
                                    moveToOthers();
                                } else {
                                    const facePredictions = faces.map(recognizer.predictBest);
                                    LOG.info(`\n${JSON.stringify(facePredictions, null, 2)}\n`);
                                    const predictions = facePredictions.filter(p => p.distance <= QUALITY);
                                    if (predictions.length === 0) {
                                        moveToOthers();
                                    } else if (predictions.map(p => p.className).includes("shin")) {
                                        moveToShin();
                                    } else {
                                        moveToFamily();
                                    }
                                }

                                done();
                            })
                            .catch(error => {
                                LOG.error("    FAILED!");
                                LOG.error(error);
                                moveToFailed();
                                done();
                            });
                    });
                }
            })
            .on("end", () => {
                async.series(tasks, (err) => {
                    if (err) {
                        errorHandler(reject)(err);
                    } else {
                        resolve();
                    }
                });
            })
            .on("error", errorHandler(reject));
    });
};

function errorHandler(reject) {
    return error => {
        LOG.error(error);
        reject(error);
    };
}
