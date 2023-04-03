/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalHost } from '../../env/LocalHost.js'
import { LevelChunkManager } from './LevelChunkManager.js';
import { LevelNVD } from './LevelNVD.js';
import { WebServerTransceiver } from './WebServerTransceiver.js';
import { UDPTransceiver } from './UDPTransceiver.js';
import { NodeCryptoManager } from './NodeCryptoManager.js';
import { NVD } from '../../basic/NVD.js';
import { cryptoManager } from '../../basic/CryptoManager.js';
import { setupBasicCollectionTypes } from './NodeSetup.js';

export * from '../shared/CommonSetup.js';

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
