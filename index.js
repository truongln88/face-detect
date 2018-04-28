"use strict";

const inquirer = require("inquirer");

const P_MAP = new Map([
    ["Extract Faces", "./src/extract-faces.js"],
    ["Training", "./src/training.js"],
    ["Filter", "./src/filter.js"]
]);

(async function() {
    const { program } = await inquirer.prompt([{
        type: "list",
        name: "program",
        message: "Please choose program to run!",
        choices: [...P_MAP.keys()]
    }]);

    await require(P_MAP.get(program))();
})();
