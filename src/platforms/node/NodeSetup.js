
import {LocalHost} from '../../env/LocalHost'
import {LevelResourcesManager} from './LevelResourcesManager';
import {LevelNVD} from './LevelNVD';
import {WebServerTransceiver} from './WebServerTransceiver';
import {UDPTransceiver} from './UDPTransceiver';
import {NVD} from '../../basic/NVD';
import {logger} from '../../basic/Log';
import { cryptoManager } from '../../basic/CryptoManager';
import { NodeCryptoManager } from './NodeCryptoManager';

export * from '../shared/CommonSetup';

export async function setupLocalHost() {
    if(global.crypto === undefined) {
        global.crypto = require('crypto').webcrypto;
    }
    LevelNVD.init();
    LevelResourcesManager.init();
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
