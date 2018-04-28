"use strict";

const sharp = require("sharp");
const walk = require("klaw");
const fs = require("fs-extra");
const path = require("path");
const LOG = require("winston");
const fr = require("face-recognition");
const async = require("async");

const IMG_WIDTH = 800;
const DIR_SMALL = "small";
const DIR_FACES = "faces";
const PERSON_FOLDER_PREFIX = "p-";

module.exports = async function() {
    const tasks = [];

    await (new Promise((resolve, reject) => {
        walk("data", {
            depthLimit: 0
        })
            .on("data", item => {
                if (item.stats.isDirectory() && path.parse(item.path).base.startsWith(PERSON_FOLDER_PREFIX)) {
                    tasks.push(done => {
                        extractFacesForPerson(item.path).then(done);
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
    }))();
};

async function extractFacesForPerson(dir) {
    LOG.info(`Extract faces from person: ${dir}`);
    const tasks = [];

    fs.ensureDirSync(path.join(dir, DIR_SMALL));
    fs.ensureDirSync(path.join(dir, DIR_FACES));

    return new Promise((resolve, reject) => {
        walk(dir, {
            depthLimit: 0
        })
            .on("data", async item => {
                if (item.stats.isFile() && !item.path.startsWith(".")) {
                    tasks.push(done => {
                        const itemPath = item.path;
                        LOG.info(`    Image: ${itemPath}`);
                        const pathInfo = path.parse(itemPath);
                        let smallFilePath = path.join(pathInfo.dir, DIR_SMALL, pathInfo.base);
                        sharp(itemPath)
                            .resize(IMG_WIDTH)
                            .toFile(smallFilePath)
                            .then(() => {
                                LOG.info(`        Small: ${smallFilePath}`);
                                const detector = fr.FaceDetector();
                                const faceImages = detector.detectFaces(fr.loadImage(smallFilePath));
                                faceImages.forEach((faceImage, i) => {
                                    const facePath = path.join(pathInfo.dir, DIR_FACES, `${pathInfo.name}_${i}${pathInfo.ext}`);
                                    fr.saveImage(facePath, faceImage);
                                    LOG.info(`        Face: ${facePath}`);
                                });
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
}

function errorHandler(reject) {
    return error => {
        LOG.error(error);
        reject(error);
    };
}
