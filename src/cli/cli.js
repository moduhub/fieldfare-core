
import arg from 'arg';
import fs from 'fs';

const HostManager = require('../HostManager.js');
//import HostManager from '../HostManager';

const Environment = require('../Environment.js');

const LevelResourcesManager = require('../resources/LevelResourcesManager.js');

const LevelNVData = require('../nvd/LevelNVData.js');

const UDPTransceiver = require('../UDPTransceiver.js');

const Utils = require('../basic/Utils.js');

const WebClientTransceiver = require('../WebClientTransceiver.js');

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

    webClientTransceiver = new WebClientTransceiver();

    const udpPort = Math.floor(Math.random() * (maxUDPPort - minUDPPort) + minUDPPort);
    console.log('Opening UDP port ' + udpPort);
    udpTransceiver = new UDPTransceiver(udpPort);

    udpTransceiver.onNewChannel = (newChannel) => {

        console.log("UDPtrx onNewChannel");
        host.bootChannel(newChannel);

    };

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

async function initBootWebports() {

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

                console.log("Opening UDp destination: " + webport.address + ":" + webport.port);

                var udpChannel = udpTransceiver.newChannel(webport.address, webport.port);

                host.bootChannel(udpChannel);

            } break;

            default:
                throw Error('invalid webport protocol: ' + webport.protocol);
        }

    }

}

async function addBootWebport(options) {

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

    const webportsJSON = await nvdata.load('bootWebports');

    var webports;

    if(webportsJSON === null
    || webportsJSON === undefined) {
        webports = [];
    } else {
        webports = JSON.parse(webportsJSON);
    }

    const newWebportData = {
        protocol: protocol,
        address: options.address,
        port: options.port
    };

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


export async function cli(args) {

    let options = parseArgumentsIntoOptions(args);
    console.log(options);

    //Note: On node it is necessary to provide the correct webcrypto implementation
    global.crypto = require('crypto').webcrypto;

    global.nvdata = new LevelNVData();

    switch(options.operation) {

        case 'setEnvironment': {

            try {

                await setEnvironment(options);

            } catch(error) {

                console.log("Set enviroment failed: " + error);

                process.exit(1);
            }

        } break;

        case 'addBootWebport': {

            console.log('>>addBootWebport ' + options.address + ':' + options.port);

            try {

                await addBootWebport(options);

            } catch(error) {

                console.log("Add boot webport failed: " + error);

                process.exit(1);
            }

        } break;

        case 'clearBootWebports' : {

            await nvdata.save('bootWebports', "[]");

        } break;

        case 'getChanges': {

            await initHost(options);
            await initEnvironment(options);
            // await initBootWebports();
            // await env.sync();

            const localChain = new VersionChain(env.version, host.id, 50);

            const localChanges = await localChain.getChanges();

            for await (const [issuer, method, params] of localChanges) {
                console.log('issuer:\"' + issuer + '\" method:' + method + ' params:\n'+ JSON.stringify(params, null, 2));
            }

        } break;

        case 'getAdmins': {

            await initHost(options);
            await initEnvironment(options);
            await initBootWebports();
            await env.sync();

            console.log(">>getAdmins from " + envUUID);

            const envAdmins = env.elements.get('admins');
            for await (const admin of envAdmins) {
                console.log(">> " + admin);
            }

        } break;

        case 'getProviders': {

            await initHost(options);
            await initEnvironment(options);
            await initBootWebports();
            await env.sync();

            console.log('>>getProviders of service ' + options.uuid + ' from env ' + envUUID);

            const providers = env.elements.get(options.uuid + '.providers');
            for await (const hostid of providers) {
                console.log(">> " + hostid);
            }

        } break;

        case 'addAdmin': {

                await initHost(options);
                await initEnvironment(options);
                await initBootWebports();

                console.log(">>addAdmin " + options.host
                    + 'to environment ' + envUUID);

                console.log("awaiting env sync before edit");
                await env.sync();

                await env.addAdmin(options.host);

                console.log("awaiting env sync after edit");
                await env.sync();

        } break;

        default: {
            console.log('Unknown operation: ' + options.operation);
        } break;
    }

    process.exit(0);
}
