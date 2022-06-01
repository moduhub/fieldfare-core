
import inquirer from 'inquirer';

import * as actions from './setupFunctions'

import {
    getHostID,
    importPrivateKey,
    generatePrivateKey
} from '../basic/keyManagement';

import {Utils} from '../basic/Utils';

import {inputWebport} from './menuCommon';


const uuidInputQuestion = {
    type: 'input',
    name: 'uuid',
    message: "Please enter an UUID (leave blank to cancel)",
    validate(value) {

        if (Utils.isUUID(value)
        || value === '') {
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

            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: "Are you sure you want to drop previous UUID?"
            });

            if(confirm) {
                const answer = await inquirer.prompt(uuidInputQuestion);
                if(answer.uuid !== '')  {
                    await actions.setEnvironmentUUID(answer.uuid);
                }
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
        case 'Generate Private Key': {

            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: "Are you sure you want to drop previous Private Key?"
            });

            if(confirm) {
                await actions.generatePrivateKey();
            }

            localHostMenu();

        } break;

        default:
            mainMenu();
    }

}

async function bootWebportsMenu() {

    const prompt = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Add Webport', 'Remove Webport', 'Remove All', 'Back'],
    };

    console.log("__________ Boot Webports Configuration __________");

    const webports = await actions.getBootWebports();

    if(webports) {
        console.table(webports);
    } else {
        console.log(" <No boot webports defined>");
    }

    const answer = await inquirer.prompt(prompt);

    switch(answer.action) {
        case 'Add Webport':
            const answers = await inquirer.prompt(inputWebport);
            console.log(JSON.stringify(answers));
            await actions.addBootWebport(answers);
            bootWebportsMenu();
            break;

        case 'Remove Webport': {
            if(webports.length > 0) {
                var index = 0;
                if(webports.length > 1) {
                    const answer = await inquirer.prompt({
                        type: 'input',
                        name: 'index',
                        validate(value) {
                            if(value !== undefined
                            && value !== null
                            && value !== '') {
                                const number = parseInt(value);
                                if(value >= 0
                                && value < webports.length) {
                                    return true;
                                }
                            }

                            return "Enter an index between (including) 0 and " + (webports.length-1);
                        }
                    });
                    index = parseInt(answer.index);
                }

                const webportToRemove = webports[index];

                console.table(webportToRemove);

                const {confirm} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure you with to drop this webport?'
                });

                if(confirm) {
                    await actions.removeBootWebport(index);
                }

                bootWebportsMenu();

            } else {
                console.log("Boot webports registry is empty");
            }
        } break;

        case 'Remove All': {

            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: "Are you sure you want to drop all Boot Webports?"
            });

            if(confirm) {
                await actions.removeAllBootWebports();
            }

            bootWebportsMenu();

        } break;

        default:
            mainMenu();
    }
}

function mainMenu() {

    const menu = {
      type: 'list',
      name: 'submenu',
      message: 'Choose one module to configure: ',
      choices: ['Local Host', 'Environment', 'Boot Webports', 'Exit'],
    };

    console.log('--- ModuHub mhlib.js configuration ---');

    inquirer.prompt(menu).then((answers) => {
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
