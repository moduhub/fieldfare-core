#!/usr/bin/env node
import {main as setup} from '../src/cli/setup.js';
import {main as envconfig} from '../src/cli/env.js';
import {main as run} from '../src/cli/run.js';

if(process.argv.length >= 3) {
    const splicedArgs = [...process.argv.slice(0, 2), ...process.argv.slice(3)];
    switch(process.argv[2]) {
        case 'setup': {
            setup(splicedArgs);
        } break;
        case 'envconfig': {
            envconfig(splicedArgs);
        } break;
        case 'run': {
            run(splicedArgs);
        } break;
        default: {
            console.log('Invalid command: ' + process.argv[2]);
        }
    }
} else {
    console.log('No command specified');
}

