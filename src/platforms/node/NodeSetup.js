
import { LocalHost } from '../../env/LocalHost'
import { LevelChunkManager } from './LevelChunkManager';
import { LevelNVD } from './LevelNVD';
import { WebServerTransceiver } from './WebServerTransceiver';
import { UDPTransceiver } from './UDPTransceiver';
import { NodeCryptoManager } from './NodeCryptoManager';
import { NVD } from '../../basic/NVD';
import { logger } from '../../basic/Log';
import { cryptoManager } from '../../basic/CryptoManager';


export * from '../shared/CommonSetup';

export async function setupLocalHost() {
    if(global.crypto === undefined) {
        global.crypto = require('crypto').webcrypto;
    }
    LevelNVD.init();
    LevelChunkManager.init();
    NodeCryptoManager.init();
    const localKeypair = await cryptoManager.getLocalKeypair();
    LocalHost.init(localKeypair);
    LocalHost.assignWebportTransceiver('ws', new WebServerTransceiver);
    LocalHost.assignWebportTransceiver('udp', new UDPTransceiver);
}

export async function getBootWebports() {
    const webportsJSON = await NVD.load('bootWebports');
    var bootWebports;
    if(webportsJSON === null
    || webportsJSON === undefined) {
        bootWebports = [];
    } else {
        bootWebports = JSON.parse(webportsJSON);
    }
    return bootWebports;
}
