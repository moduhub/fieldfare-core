
import inquirer from 'inquirer';
import arg from 'arg';
import fs from 'fs';

import {initHost, initEnvironment, initWebports} from './cliCommon';

const Utils = require('../basic/Utils.js');

const VersionChain = require('../versioning/VersionChain.js');

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

async function mainMenu() {

    const menu = {
      type: 'list',
      name: 'submenu',
      message: 'Choose one module to configure: ',
      choices: ['Admins', 'Services', 'Providers', 'Webports', 'Exit'],
    };

    console.log('--- ModuHub mhlib.js Environment configuration ---');

    const {submenu} = await inquirer.prompt(menu)

    switch (submenu) {
        case 'Admins':
            mainMenu();
            break;

        case 'Services':
            mainMenu();
            break;

        case 'Providers':
            mainMenu();
            break;

        default:
            console.log("All done! Exit...");
            process.exit(0);
    }

}


export async function main(args) {

    const options = parseArgumentsIntoOptions(args);
    // console.log(options);

    await initHost();
    const env = await initEnvironment();
    await initWebports(env);

    switch(options.operation) {

        case 'menu': {
            await mainMenu();
        } break;

        case 'addServedWebport' : {

            try {
                await addServedWebport(options);
            } catch (error) {
                console.log("Failed to add served webport: " + error);
            } finally {
                process.exit(0);
            }

        } break;

        case 'removeServedWebports': {

            try {
                await removeServedWebports(options);
            } catch (error) {
                console.log("Failed to remove served webports: " + error);
            } finally {
                process.exit(0);
            }

        } break;

        case 'getChanges': {

            const localChain = new VersionChain(env.version, host.id, 50);

            const localChanges = await localChain.getChanges();

            for await (const [issuer, method, params] of localChanges) {
                console.log('issuer:\"' + issuer + '\" method:' + method + ' params:\n'+ JSON.stringify(params, null, 2));
            }

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
                const webport = await host.getResourceObject(resource);
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

            await env.sync();

            process.exit(0);

        } break;

        default: {
            console.log('Unknown operation: ' + options.operation);
            process.exit(1);
        } break;
    }


}
