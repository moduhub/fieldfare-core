
import arg from 'arg';
import fs from 'fs';

const HostManager = require('../HostManager.js');
//import HostManager from '../HostManager';

const Environment = require('../Environment.js');

const LevelResourcesManager = require('../resources/LevelResourcesManager.js');

const LevelNVData = require('../nvd/LevelNVData.js');

const WebServerTransceiver = require('../WebServerTransceiver.js');
//const WebClientTransceiver = require('../WebClientTransceiver.js');
const UDPTransceiver = require('../UDPTransceiver.js');

const Utils = require('../basic/Utils.js');

const VersionChain = require('../versioning/VersionChain.js');


function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
    {
        '--key': String,
        '--host': String,
        '--uuid': String,
        '--operation': String,
        '--address': String,
        '--port':String,
        '--file':String,
        '-k': '--key',
        '-o': '--operation',
    },
    {
        argv: rawArgs.slice(2),
    }
    );
    return {
        privateKeyFile: args['--key'] || 'privateKey.jwk',
        uuid: args['--uuid'] || null,
        host: args['--host'] || null,
        address: args['--address'] || null,
        port: args['--port'] || null,
        operation: args['--operation'] || false,
        file: args['--file'] || null
    };
}

var envUUID;
var env;
var webClientTransceiver;
var udpTransceiver;

const minUDPPort = 10000;
const maxUDPPort = 60000;

async function initHost(options) {

    global.host = new HostManager();

    host.addResourcesManager(new LevelResourcesManager());

    const privateKeyData = JSON.parse(fs.readFileSync(options.privateKeyFile, { encoding: 'utf8' }));

    await host.setupId(privateKeyData);

}

async function setEnvironment(options) {

    console.log(">>setEnvironment to " + options.uuid);

    if(Utils.isUUID(options.uuid) === false) {
        throw Error('invalid UUID');
    }

    envUUID = options.uuid;
    await nvdata.save('envUUID', envUUID);

}

async function initEnvironment(options) {

    envUUID = await nvdata.load('envUUID');

    if(envUUID === null
    || envUUID === undefined) {
        throw Error('Environment UUID not set');
    }

    env = new Environment();

    console.log("Setting up env " + envUUID);

    await env.init(envUUID);

	host.addEnvironment(env);
}


async function initWebports() {

    //Part 1: Serve webports required in env
    const servedWebports = await env.getWebports(host.id);

    for(const webport of servedWebports) {

        switch (webport.protocol) {

            case 'ws': {

                if(wsServerTransceiver) {
                    throw Error('Cannot serve more than one WS port');
                }

                // if(wsClientTransceiver) {
                //     throw Error('Cannot serve WS port while operating as a WS client');
                // }

                wsServerTransceiver = new WebServerTransceiver(webport.port);

            } break;

            case 'udp': {

                if(udpTransceiver) {
                    throw Error('Cannot serve more than one UDP port');
                }

                console.log('Opening UDP port ' + webport.port);
                udpTransceiver = new UDPTransceiver(webport.port);
                udpTransceiver.onNewChannel = (newChannel) => {
                    host.bootChannel(newChannel);
                };

            } break;

            default:
                throw Error('invalid webport protocol: ' + webport.protocol);
        }

    }

    // Part2: Boot webports
    const webportsJSON = await nvdata.load('bootWebports');

    var webports;

    if(webportsJSON === null
    || webportsJSON === undefined) {
        webports = [];
    } else {
        webports = JSON.parse(webportsJSON);
    }

    for (const webport of webports) {

        switch (webport.protocol) {

            // case 'ws': {
            //
            //     var wsChannel = await webClientTransceiver.newChannel(webport.address, webport.port);
            //
            //     host.bootChannel(wsChannel);
            //
            // } break;

            case 'udp': {

                if(udpTransceiver === undefined
                || udpTransceiver === null) {
                    //If no udp serve port specified, use a random one
                    const udpPort = Math.floor(Math.random() * (maxUDPPort - minUDPPort) + minUDPPort);
                    console.log('Opening UDP port ' + udpPort);
                    udpTransceiver = new UDPTransceiver(udpPort);
                    udpTransceiver.onNewChannel = (newChannel) => {
                        host.bootChannel(newChannel);
                    };
                }

                console.log("Opening UDP destination: " + webport.address + ":" + webport.port);

                var udpChannel = udpTransceiver.newChannel(webport.address, webport.port);

                host.bootChannel(udpChannel);

            } break;

            default:
                throw Error('invalid webport protocol: ' + webport.protocol);
        }

    }

}

function webportFromOptions(options) {

    //Check Parameters
    if(options.address === null
    || options.address === undefined) {
        throw Error('Missing webport address');
    }

    if(options.port === null
    || options.port === undefined) {
        throw Error('Missing webport port');
    }

    var protocol;
    if(options.address.search('ws://') === 0) {
        protocol = 'ws';
    } else
    if(Utils.isIPV4(options.address)) {
        protocol = 'udp';
    } else {
        throw Error('Invalid address, must start with ws:// or be a valid IPv4');
    }

    if(options.port <= 0
    && options.port > 65535) {
        throw Error('Invalid port range');
    }

    return {
        protocol: protocol,
        address: options.address,
        port: options.port
    };
}

async function addBootWebport(options) {

    const webportsJSON = await nvdata.load('bootWebports');

    var webports;

    if(webportsJSON === null
    || webportsJSON === undefined) {
        webports = [];
    } else {
        webports = JSON.parse(webportsJSON);
    }

    const newWebportData = webportFromOptions(options);

    if(webports.includes(newWebportData)) {
        throw Error('Webport already defined');
    }

    webports.push(newWebportData);

    await nvdata.save('bootWebports', JSON.stringify(webports));

    console.log('Current webports: ');
    for(const webport of webports) {
        console.log(JSON.stringify(webport));
    }

}

async function addServedWebport(options) {

    console.log("addServedWebport running");

    var newWebportData = webportFromOptions(options);

    newWebportData.hostid = host.id;

    console.log("adding served webport to env:" + JSON.stringify(newWebportData));

    await env.addWebport(newWebportData);

}

async function removeServedWebports(options) {

    throw Error('uninmplemented');

}

export async function cli(args) {

    let options = parseArgumentsIntoOptions(args);
    console.log(options);

    //Note: On node it is necessary to provide the correct webcrypto implementation
    global.crypto = require('crypto').webcrypto;

    global.nvdata = new LevelNVData();

    switch(options.operation) {

        case 'serve' : {

            await initHost(options);
            await initEnvironment(options);
            await initWebports();

            const {setup} = await import(process.cwd() + '\\' + options.file);

            await setup(env);

        } break;

        case 'setEnvironment': {

            try {

                await setEnvironment(options);

            } catch(error) {

                console.log("Set enviroment failed: " + error);

                process.exit(1);
            }

            process.exit(0);

        } break;

        case 'addBootWebport': {

            console.log('>>addBootWebport ' + options.address + ':' + options.port);

            try {

                await addBootWebport(options);

            } catch(error) {

                console.log("Add boot webport failed: " + error);

                process.exit(1);
            }

            process.exit(0);

        } break;

        case 'getBootWebports': {

            const webportsJSON = await nvdata.load('bootWebports');

            //const webports = JSON.parse(webportsJSON);

            console.log(webportsJSON);

            process.exit(0);
        }

        case 'clearBootWebports' : {

            await nvdata.save('bootWebports', "[]");

            process.exit(0);

        } break;

        case 'addServedWebport' : {

            try {
                await initHost(options);
                await initEnvironment(options);
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

            await initHost(options);
            await initEnvironment(options);

            const localChain = new VersionChain(env.version, host.id, 50);

            const localChanges = await localChain.getChanges();

            for await (const [issuer, method, params] of localChanges) {
                console.log('issuer:\"' + issuer + '\" method:' + method + ' params:\n'+ JSON.stringify(params, null, 2));
            }

            process.exit(0);

        } break;

        case 'getAdmins': {

            await initHost(options);
            await initEnvironment(options);

            console.log(">>getAdmins from " + envUUID);

            const envAdmins = env.elements.get('admins');
            for await (const admin of envAdmins) {
                console.log(">> " + admin);
            }

            process.exit(0);

        } break;

        case 'getProviders': {

            await initHost(options);
            await initEnvironment(options);

            console.log('>>getProviders of service ' + options.uuid + ' from env ' + envUUID);

            const providers = env.elements.get(options.uuid + '.providers');
            for await (const hostid of providers) {
                console.log(">> " + hostid);
            }

            process.exit(0);

        } break;

        case 'getWebports': {

            await initHost(options);
            await initEnvironment(options);
            const webports = await env.elements.get('webports');
            for await (const resource of webports) {
                const webport = await host.getResourceObject(resource);
                console.log(JSON.stringify(webport));
            }
            process.exit(0);

        } break;

        case 'addAdmin': {

                await initHost(options);
                await initEnvironment(options);

                console.log(">>addAdmin " + options.host
                    + 'to environment ' + envUUID);

                await env.addAdmin(options.host);

                process.exit(0);

        } break;

        case 'sync': {

            await initHost(options);
            await initEnvironment(options);
            await initWebports();

            await env.sync();

            process.exit(0);

        } break;

        default: {
            console.log('Unknown operation: ' + options.operation);
            process.exit(1);
        } break;
    }


}
