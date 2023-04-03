/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import fs from 'fs';
import arg from 'arg';
import {NVD} from '../basic/NVD.js';
import {LocalHost} from '../env/LocalHost.js';
import {ffinit, LocalService} from '../platforms/node/NodeExports.js';
import {logger} from '../basic/Log.js'
import {dashboard} from './dashboard.js';
import chalk from 'chalk';

var env;

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
    {
        '--dashboard': Boolean,
        '--daemon': Boolean
    },
    {
        argv: rawArgs.slice(2),
    }
    );

    var path = '';

    if(rawArgs[2] && rawArgs[2].search('--')) {
        path = rawArgs[2];
    }

    return {
        path:  path,
        dashboard: args['--dashboard'] || false,
        daemon: args['--daemon'] || false
    };
}

export async function main(args) {

    logger.log('info', "===== System started at " + Date.now());

    const options = parseArgumentsIntoOptions(args);

    try {
        await ffinit.setupLocalHost();
        env = await ffinit.setupEnvironment();
        // const envWebports = env.elements.get('webports');
        // if(await envWebports.isEmpty()) {
        //     const bootWebports = await ffinit.getBootWebports();
        //     for(const webport of bootWebports) {
        //         try {
        //             await LocalHost.connectWebport(webport);
        //             break;
        //         } catch (error) {
        //             logger.error("Cannot reach " + webport.address + " at port " + webport.port + ' cause: ' + error);
        //         }
        //     }
        // }
    } catch (error) {
        logger.error('Fieldfare initialization failed: ' + error);
        console.log(error.stack);
        process.exit(0);
    }
    if(options.dashboard) {
        try {
            logger.disable();
            dashboard(env);
        } catch (error) {
            logger.error('Failed to start dashboard');
        }
    } else
    if(options.daemon) {
        logger.disable();
    }
    //Fetch service implementations from NVD
    const implementationFilesJSON = await NVD.load('implementations');
    const implementationFiles = JSON.parse(implementationFilesJSON);
    if(implementationFiles) {
        for (const filepath of implementationFiles) {
            logger.info("Loading service implementation from " + filepath);
            try {
                if(!fs.existsSync(filepath)) {
                    throw Error('Service directory not found');
                }
                const {uuid, implementation} = await import('file:' + filepath);
                LocalService.registerImplementation(uuid, implementation);
                logger.info("Service " + uuid + " successfully installed");
            } catch (error) {
                logger.error(chalk.red("Failed to setup service module at \'" + options.path + '\': ' + error.stack));
                process.exit(1);
            }
        }
    } else {
        logger.log('info', "No service defined, running environment basics only");
    }
    logger.log('Joining environment ' + env.uuid);
    await LocalHost.join(env);
}
