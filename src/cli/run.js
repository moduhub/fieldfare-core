import fs from 'fs';
import arg from 'arg';
import {initHost, initEnvironment, initWebports} from './cliCommon';
import winston from 'winston';
import {logger} from '../basic/Log'
import chalk from 'chalk';
import {dashboard} from './dashboard';

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

    const options = parseArgumentsIntoOptions(args);

    await initHost();
    const env = await initEnvironment();
    await initWebports(env);

    if(options.dashboard) {

        try {
            dashboard(env);
        } catch (error) {
            logger.error('Failed to start dashboard');
        }

    } else
    if(options.daemon === false) {
        logger.add(new winston.transports.Console({
           format: winston.format.simple(),
        }));
    }

    if(options.path !== '') {

        const fullpath = process.cwd() + '\\' + options.path;

        try {

            if(fs.existsSync(fullpath)) {

                const {setup} = await import(fullpath);

                await setup(env);

            } else {
                throw Error('File not found');
            }
        } catch (error) {
            console.log(chalk.red("Failed to setup service module at \'" + options.path + '\': ' + error));
            process.exit(1);
        }
    } else {
        logger.log('info', "No service defined, running environment basics only");
    }

}
