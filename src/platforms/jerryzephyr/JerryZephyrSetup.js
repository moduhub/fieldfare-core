/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {LocalHost} from '../../env/LocalHost.js';
import {JerryZephyrCrypto} from './JerryZephyrCrypto.js';
import {FileSystemNVD} from '../shared/FileSystemNVD.js';
import {FileSystemChunkManager} from '../shared/FileSystemChunkManager.js';

export * from '../shared/CommonSetup.js';

export async function setupLocalHost() {
    if(global.crypto === undefined) {
        global.crypto = JerryZephyrCrypto;
    }
    FileSystemNVD.init();
    FileSystemChunkManager.init();
    const privateKeyData = JerryZephyrCrypto.loadPrivateKey();
    LocalHost.init(privateKeyData);
}
