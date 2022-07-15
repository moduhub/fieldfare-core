
import inquirer from 'inquirer';
import arg from 'arg';
import fs from 'fs';

import {LocalHost} from '../env/LocalHost';
import {ResourcesManager} from '../resources/ResourcesManager';
import {VersionChain} from '../versioning/VersionChain';
import {Utils} from '../basic/Utils';
import {ffinit} from '../platforms/node/NodeExports';

import {
    inputWebport,
    inputUUID
} from './menuCommon';
import {logger} from '../basic/Log';

import chalk from 'chalk';

const title = chalk.bold.blue;

var env;

function hasSpecialChars(value) {
    const regex = /^[a-zA-Z0-9!@#\$%\^\&*\)\(+=._-]+$/g;
    return !(regex.test(value));
}

const inputHostID = {
    type: 'input',
    name: 'hostid',
    message: "Please enter a Host ID (leave blank to cancel or 'this' to use local host ID): ",
    validate(value) {
        if(value == ''
        || value == 'this') {
            return true;
        }

        if (Utils.isBase64(value)
        && value.length === 44) {
            return true;
        }

        return 'Please enter a valid Host ID in base64 format';
    },
    filter(value) {
        if(value === 'this') {
            return LocalHost.getID();
        }
        return value;
    }
};


const inputServiceName = {
    type: 'input',
    name: 'serviceName',
    message: 'Enter service name: ',
    validate(value) {
        if(value.length == 0) {
            return 'Please enter some value';
        }
        if(value.length > 16) {
            return 'Name is too long! (max 16 chars)';
        }
        if(hasSpecialChars(value)) {
            return 'Name contains invalid chars';
        }
        return true;
    }
}

const inputServiceMethod = {
    type: 'input',
    name: 'methodName',
    message: 'Enter a new method name, leave blank to proceed to next step: '
};

const inputServiceElementType = {
    type: 'list',
    name: 'dataType',
    message: 'Choose new element type: ',
    choices: ['list', 'set', 'map', 'geofield']
};

const inputServiceElementName = {
    type: 'input',
    name: 'dataName',
    message: 'Enter element name, leave blank to end: '
};


function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
    {
        '--host': String,
        '--uuid': String,
        '--address': String,
        '--port':String,
        '--file':String
    },
    {
        argv: rawArgs.slice(3),
    }
    );

    return {
        uuid: args['--uuid'] || null,
        host: args['--host'] || null,
        address: args['--address'] || null,
        port: args['--port'] || null,
        operation: rawArgs[2],
        file: args['--file'] || null
    };
}

async function selectHostMenu(hostIDs) {
    const menu = {
      type: 'list',
      name: 'choice',
      message: 'Choose one host ID from the list: ',
      choices: [],
      filter(value) {
          if(value === 'Back') {
              return '';
          }
          return value;
      }
    };
    for await (const id of hostIDs) {
        menu.choices.push(id);
    }
    menu.choices.push('Back');
    const {choice} = await inquirer.prompt(menu);
    return choice;
}

async function adminsMenu() {
    const menu = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Add new', 'Remove one', 'Back'],
    };
    console.log('__________ Environment Admins configuration __________');
    var adminList = []
    const envAdmins = await env.elements.get('admins');
    for await (const admin of envAdmins) {
        adminList.push(admin);
    }
    console.table(adminList);
    const {action} = await inquirer.prompt(menu);
    switch (action) {
        case 'Add new': {
            const {hostid} = await inquirer.prompt(inputHostID);
            if(hostid !== '') {
                try {
                    await env.addAdmin(hostid);
                } catch (error) {
                    console.log(chalk.red("FAILED: " + error));
                }
            }
            adminsMenu();
        } break;

        case 'Remove one': {
            const hostid = await selectHostMenu(envAdmins);
            if(hostid !== '') {
                try {
                    await env.removeAdmin(hostid);
                } catch (error) {
                    console.log(chalk.red("FAILED: " + error));
                }
            }
            adminsMenu();
        } break;

        default:
            mainMenu();
    }

}

async function selectServiceMenu() {
    const menu = {
      type: 'list',
      name: 'choice',
      message: 'Choose one service from the list: ',
      choices: [],
      filter(value) {
          if(value === 'Back') {
              return '';
          }
          const parts = value.split(': ');
          return parts[1].slice(0,-1);
      }
    };
    var servicesList = []
    const services = await env.elements.get('services');
    for await (const key of services) {
        const definition = await ResourcesManager.getResourceObject(key);
        menu.choices.push(definition.name + ' (uuid: ' + definition.uuid + ')');
    }
    menu.choices.push('Back');
    console.log(title('__________ Service Providers configuration __________'));
    const {choice} = await inquirer.prompt(menu);
    return choice;
}

async function servicesMenu() {
    const menu = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Add new', 'Remove one', 'Back'],
    };
    console.log(title('__________ Environment Services configuration __________'));
    var servicesList = []
    const services = await env.elements.get('services');
    for await (const key of services) {
        servicesList.push(await ResourcesManager.getResourceObject(key));
    }
    if(servicesList.length > 0) {
        console.table(servicesList);
    } else {
        console.log('<no services defined>');
    }
    const {action} = await inquirer.prompt(menu);
    switch (action) {
        case 'Add new': {
            try {
                await env.auth(LocalHost.getID());
                var {uuid} = await inquirer.prompt(inputUUID);
                const {serviceName} = await inquirer.prompt(inputServiceName);
                var definition = {
                    uuid: uuid,
                    name: serviceName,
                    methods: [],
                    data: []
                };
                while (true) {
                    const {methodName} = await inquirer.prompt(inputServiceMethod);
                    if(methodName === '') break;
                    definition.methods.push(methodName);
                }
                while (true) {
                    const {dataName} = await inquirer.prompt(inputServiceElementName);
                    if(dataName === '') break;
                    const {dataType} = await inquirer.prompt(inputServiceElementType);
                    definition.data.push({
                        name: dataName,
                        type: dataType
                    });
                }
                console.log("Please review the data entered: ");
                console.log(JSON.stringify(definition, null, 4));
                const {confirm} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Do you wish to confirm service inclusion?'
                });
                if(confirm) {
                    await env.addService(definition);
                }
            } catch (error) {
                console.log('Cannot add a new service: ' + error);
            }
            servicesMenu();
        } break;
        case 'Remove one': {
            const uuid = await selectServiceMenu(services);
            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: 'Do you wish to confirm service exclusion?'
            });
            if(confirm) {
                try {
                    await env.removeService(uuid);
                } catch(error) {
                    console.log(chalk.bold.red('Service remove failed: ' + error));
                }
            }
            mainMenu();
        } break;
        default:
            mainMenu();
    }

}


async function providersMenu(serviceUUID) {
    const menu = {
        type: 'list',
        name: 'action',
        message: 'Please select an action below: ',
        choices: ['Add', 'Remove', 'Back']
    }
    console.log(title('__________ Service <'+serviceUUID+'> Providers configuration __________'));
    var providersList = [];
    const providers = await env.getProviders(serviceUUID);
    for await(const provider of providers) {
        providersList.push(provider);
    }
    if(providersList.length > 0) {
        console.table(providersList);
    } else {
        console.log('<No providers defined>');
    }
    const {action} = await inquirer.prompt(menu);
    switch(action) {
        case 'Add':{
            const { hostid } = await inquirer.prompt(inputHostID);
            if(hostid != '') {
                try {
                    await env.addProvider(serviceUUID, hostid);
                } catch(error) {
                    console.log(chalk.bgRed("Provider inclusion failed: " + error));
                }
            }
            providersMenu(serviceUUID);
        }break;
        case 'Remove': {
            const hostid = await selectHostMenu(providers);
            if(hostid != '') {
                try {
                    await env.removeProvider(serviceUUID, hostid);
                } catch(error) {
                    console.log(chalk.bgRed("Provider exclusion failed: " + error));
                }
            }
            providersMenu(serviceUUID);
        } break;
        default:
            mainMenu();
    }
}

async function webportsMenu() {

    const menu = {
        type: 'list',
        name: 'action',
        message: 'Please select an action below: ',
        choices: ['Add', 'Back']
    }

    console.log(title('__________ Enviroment Webports configuration __________'));

    var list = [];

    const webports = env.elements.get('webports');

    for await(const key of webports) {
        const webport = await ResourcesManager.getResourceObject(key);
        list.push(webport);
    }

    if(list.length > 0) {
        console.table(list);
    } else {
        console.log('<No webports defined>');
    }

    const {action} = await inquirer.prompt(menu);

    switch(action) {
        case 'Add':{

            var newWebport = await inquirer.prompt(inputWebport);

            newWebport.hostid = LocalHost.getID();

            console.log("Review webport data: " + JSON.stringify(newWebport));

            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: 'Confirm Webport data inclusion?'
            });

            if(confirm) {
                await env.addWebport(newWebport);
            }

            webportsMenu();
        }break;

        default:
            mainMenu();
    }

}

async function mainMenu() {

    const menu = {
      type: 'list',
      name: 'submenu',
      message: 'Choose one module to configure: ',
      choices: ['Admins', 'Services', 'Providers', 'Webports', 'Exit'],
    };

    console.log(title('__________ Fieldfare Environment configuration __________'));

    if(env) {
        console.table({
            uuid: env.uuid,
            version: env.version
        })
        //console.log('Current env UUID: ' + env.uuid + ' at version: ' + env.version);
    } else {
        console.log('<No Enviroment configured>');
    }

    const {submenu} = await inquirer.prompt(menu);

    switch (submenu) {
        case 'Admins':
            adminsMenu();
            break;

        case 'Services':
            servicesMenu();
            break;

        case 'Providers':
            const serviceUUID = await selectServiceMenu();
            if(serviceUUID !== '') {
                providersMenu(serviceUUID);
            } else {
                mainMenu();
            }
            break;

        case 'Webports':
            webportsMenu();
            break;

        default:
            console.log("All done! Exit...");
            process.exit(0);
    }

}


export async function main(args) {
    const options = parseArgumentsIntoOptions(args);
    logger.disable();
    try {
        await ffinit.setupLocalHost();
        env = await ffinit.setupEnvironment();
        const envWebports = env.elements.get('webports');
        if(await envWebports.isEmpty()) {
            const bootWebports = await ffinit.getBootWebports();
            for(const webport of bootWebports) {
                try {
                    await LocalHost.connectWebport(webport);
                    break;
                } catch (error) {
                    logger.error("Cannot reach " + webport.address + " at port " + webport.port + ' cause: ' + error);
                }
            }
        }
    } catch (error) {
        console.error('Fieldfare initialization failed: ' + error.stack);
        process.exit(1);
    }

    switch(options.operation) {

        case 'menu': {
            await mainMenu();
        } break;

        case 'getChanges': {
            const localChain = new VersionChain(env.version, LocalHost.getID(), 50);
            await localChain.print();
            process.exit(0);
        } break;

        case 'getAdmins': {
            console.log(">>getAdmins from " + env.uuid);
            const envAdmins = env.elements.get('admins');
            for await (const admin of envAdmins) {
                console.log(">> " + admin);
            }
            process.exit(0);
        } break;

        case 'getProviders': {
            console.log('>>getProviders of service ' + options.uuid + ' from env ' + envUUID);
            const providers = env.elements.get(options.uuid + '.providers');
            for await (const hostid of providers) {
                console.log(">> " + hostid);
            }
            process.exit(0);
        } break;

        case 'getWebports': {
            const webports = await env.elements.get('webports');
            for await (const resource of webports) {
                const webport = await ResourcesManager.getResourceObject(resource);
                console.log(JSON.stringify(webport));
            }
            process.exit(0);
        } break;

        case 'addAdmin': {
                console.log(">>addAdmin " + options.host
                    + 'to environment ' + envUUID);
                await env.addAdmin(options.host);
                process.exit(0);
        } break;

        case 'sync': {
            try {
                await env.sync();
            } catch(error) {
                console.log(chalk.bold.red('Sync failed: ' + error));
            }
            process.exit(0);
        } break;

        default: {
            console.log('Unknown operation: ' + options.operation);
            process.exit(1);
        } break;
    }


}
