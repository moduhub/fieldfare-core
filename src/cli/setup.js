
import inquirer from 'inquirer';

import * as actions from './setupFunctions'

const Utils = require('../basic/Utils.js');

const uuidInputQuestion = {
    type: 'input',
    name: 'uuid',
    message: "Please input an UUID (leave blank to cancel)",
    validate(value) {

        if (Utils.isUUID(value)) {
            return true;
        }

        return 'Please enter a valid UUID';
    }
};

async function environmentMenu() {

    const prompt = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Set Enviroment UUID', 'Generate Random UUID', 'Back'],
    };

    console.log("__________ Environment Configuration __________");
    console.log("| Current Enviroment UUID: " + await actions.getEnvironmentUUID());

    const answer = await inquirer.prompt(prompt);

    switch(answer.action) {
        case 'Set Enviroment UUID': {
            const answer = await inquirer.prompt(uuidInputQuestion);
            if(answer.uuid !== '')  {
                await actions.setEnvironmentUUID(answer.uuid);
            }
            environmentMenu();
        } break;

        case 'Generate Random UUID': {
            environmentMenu();
        } break;

        default:
            mainMenu();
    }
}

async function localHostMenu() {

    const prompt = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Generate Private Key', 'Import Private Key', 'Back'],
    };

    console.log("__________ Local Host Configuration __________");
    console.log("| Current Host ID: " + await actions.getHostID());

    const answer = await inquirer.prompt(prompt);

    switch(answer.action) {
        case 'Generate Private Key':
            await actions.generatePrivateKey();
            localHostMenu();
            break;

        default:
            mainMenu();
    }

}

async function bootWebportsMenu() {

    const prompt = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Add Webport', 'Remove All', 'Back'],
    };

    console.log("__________ Boot Webports Configuration __________");
    //console.log("| Current Host ID: " + await actions.getHostID());

    const answer = await inquirer.prompt(prompt);

    switch(answer.action) {
        case 'Add Webport':
            bootWebportsMenu();
            break;

        case 'Remove All':
            bootWebportsMenu();
            break;

        default:
            mainMenu();
    }

}

function mainMenu() {

    const prompt = {
      type: 'list',
      name: 'submenu',
      message: 'Choose one module to configure: ',
      choices: ['Local Host', 'Environment', 'Boot Webports', 'Exit'],
    };

    console.log('--- ModuHub mhlib.js configuration ---');

    inquirer.prompt(prompt).then((answers) => {
        switch (answers.submenu ) {
            case'Local Host':
                localHostMenu();
                break;

            case 'Environment':
                environmentMenu();
                break;

            case 'Boot Webports':
                bootWebportsMenu();
                break;

            default:
                console.log("All done! Exit...");
                process.exit(0);
        }
    });
}

export async function main(args) {

    await actions.init();

    mainMenu();

}
