
import { LocalHost } from '../../env/LocalHost'
import { LevelChunkManager } from './LevelChunkManager';
import { LevelNVD } from './LevelNVD';
import { WebServerTransceiver } from './WebServerTransceiver';
import { UDPTransceiver } from './UDPTransceiver';
import { NodeCryptoManager } from './NodeCryptoManager';
import { NVD } from '../../basic/NVD';
import { logger } from '../../basic/Log';
import { cryptoManager } from '../../basic/CryptoManager';
import { setupBasicCollectionTypes } from './NodeSetup';


export * from '../shared/CommonSetup';

export async function setupLocalHost() {
    LevelNVD.init();
    LevelChunkManager.init();
    await NodeCryptoManager.init();
    setupBasicCollectionTypes();
    const localKeypair = await cryptoManager.getLocalKeypair();
    await LocalHost.init(localKeypair);
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
