
import {LocalHost} from '../../env/LocalHost'
import {Environment} from '../../env/Environment'
import {LevelResourcesManager} from './LevelResourcesManager';
import {LevelNVD} from './LevelNVD';
import {WebServerTransceiver} from './WebServerTransceiver';
import {UDPTransceiver} from './UDPTransceiver';
import {NVD} from '../../basic/NVD';
import {logger} from '../../basic/Log';

var webServerTransceiver;
var udpTransceiver;

const minUDPPort = 10000;
const maxUDPPort = 60000;

export async function setupLocalHost() {

    if(global.crypto === undefined) {
        global.crypto = require('crypto').webcrypto;
    }

    LevelNVD.init();

    LevelResourcesManager.init();

    const privateKeyData = await NVD.load('privateKey');

    LocalHost.init(privateKeyData);

}

export async function setupEnvironment() {

    const envUUID = await NVD.load('envUUID');

    if(envUUID === null
    || envUUID === undefined) {
        throw Error('Environment UUID not set');
    }

    const env = new Environment();

    logger.log('info', "Setting up env " + envUUID);

    await env.init(envUUID);

	LocalHost.addEnvironment(env);

    return env;
}


export async function initWebports(env) {

    //Part 1: Serve webports required in env
    const servedWebports = await env.getWebports(LocalHost.getID());

    for(const webport of servedWebports) {

        switch (webport.protocol) {

            case 'ws': {

                if(webServerTransceiver) {
                    throw Error('Cannot serve more than one WS port');
                }

                // if(webClientTransceiver) {
                //     throw Error('Cannot serve WS port while operating as a WS client');
                // }

                logger.info('Opening WS server port: ' + webport.port)
                webServerTransceiver = new WebServerTransceiver(webport.port);
                webServerTransceiver.open();
                webServerTransceiver.onNewChannel = (newChannel) => {
                    logger.debug('WS server onNewChannel');
                    LocalHost.bootChannel(newChannel);
                };

            } break;

            case 'udp': {

                if(udpTransceiver) {
                    throw Error('Cannot serve more than one UDP port');
                }

                logger.log('info', 'Opening UDP port ' + webport.port);
                udpTransceiver = new UDPTransceiver(webport.port);
                udpTransceiver.onNewChannel = (newChannel) => {
                    LocalHost.bootChannel(newChannel);
                };

            } break;

            default:
                throw Error('invalid webport protocol: ' + webport.protocol);
        }

    }

    // Part2: Boot webports
    const webportsJSON = await NVD.load('bootWebports');

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
            //     LocalHost.bootChannel(wsChannel);
            //
            // } break;

            case 'udp': {

                if(udpTransceiver === undefined
                || udpTransceiver === null) {
                    //If no udp serve port specified, use a random one
                    const udpPort = Math.floor(Math.random() * (maxUDPPort - minUDPPort) + minUDPPort);
                    logger.log('info', 'Opening UDP port ' + udpPort);
                    udpTransceiver = new UDPTransceiver(udpPort);
                    udpTransceiver.onNewChannel = (newChannel) => {
                        LocalHost.bootChannel(newChannel);
                    };
                }

                logger.log('info', "Opening UDP destination: " + webport.address + ":" + webport.port);

                var udpChannel = udpTransceiver.newChannel(webport.address, webport.port);

                LocalHost.bootChannel(udpChannel);

            } break;

            default:
                throw Error('invalid webport protocol: ' + webport.protocol);
        }

    }

}
