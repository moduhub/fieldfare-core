
import {initHost, initEnvironment, initWebports} from './cliCommon';

export async function main(args) {

    console.log('args: ' + args);

    await initHost();
    const env = await initEnvironment();
    await initWebports(env);

    if(args) {
        try {
            const {setup} = await import(process.cwd() + '\\' + args);

            await setup(env);
        } catch (error) {
            console.log("Failed to setup service module: " + args);
        }
    } else {
        console.log("No service defined, running environment basics only");
    }

}
