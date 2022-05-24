
const HostManager = require('../HostManager.js');
//import HostManager from '../HostManager';

const Environment = require('../Environment.js');

const LevelResourcesManager = require('../resources/LevelResourcesManager.js');

const LevelNVData = require('../nvd/LevelNVData.js');

const WebServerTransceiver = require('../WebServerTransceiver.js');
//const WebClientTransceiver = require('../WebClientTransceiver.js');
const UDPTransceiver = require('../UDPTransceiver.js');


var webClientTransceiver;
var udpTransceiver;

const minUDPPort = 10000;
const maxUDPPort = 60000;

export async function initHost() {

    if(global.nvdata === undefined) {
        global.nvdata = new LevelNVData;
    }

    if(global.crypto === undefined) {
        global.crypto = require('crypto').webcrypto;
    }

    global.host = new HostManager();

    host.addResourcesManager(new LevelResourcesManager());

    const privateKeyData = await nvdata.load('privateKey');

    await host.setupId(privateKeyData);

}

export async function initEnvironment() {

    const envUUID = await nvdata.load('envUUID');

    if(envUUID === null
    || envUUID === undefined) {
        throw Error('Environment UUID not set');
    }

    const env = new Environment();

    console.log("Setting up env " + envUUID);

    await env.init(envUUID);

	host.addEnvironment(env);

    return env;
}

export async function initWebports(env) {

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
