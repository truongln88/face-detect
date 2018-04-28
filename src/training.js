"use strict";

const fr = require("face-recognition");
const path = require("path");
const walk = require("klaw");
const async = require("async");
const LOG = require("winston");
const fs = require("fs-extra");

const NUM_JITTERS = 15;

module.exports = async function() {
    const recognizer = fr.FaceRecognizer();
    const persons = ["mama", "nam", "nhi", "oma", "opa", "papa", "shin"];
    const tasks = persons.map(person => (done => {
        const dir = path.join("data", person, "faces");
        const faces = [];

        LOG.info(`Process ${person}`);

        walk(dir, {
            depthLimit: 0
        })
            .on("data", item => {
                if (item.stats.isFile() && !path.parse(item.path).base.startsWith(".")) {
                    LOG.info(`    Load face ${item.path}.`);
                    faces.push(fr.loadImage(item.path));
                }
            })
            .on("end", () => {
                LOG.info("    Add faces.");
                recognizer.addFaces(faces, person, NUM_JITTERS);
                LOG.info("    Faces added.");
                done();
            })
            .on("error", done);
    }));

    return new Promise((resolve, reject) => {
        async.series(tasks, (err) => {
            if (err) {
                errorHandler(reject)(err);
            } else {
                LOG.info("Write model data...");
                fs.writeFileSync("model.json", JSON.stringify(recognizer.serialize()));
                LOG.info("Model data written.");
                resolve();
            }
        });
    });
};

function errorHandler(reject) {
    return error => {
        LOG.error(error);
        reject(error);
    };
}