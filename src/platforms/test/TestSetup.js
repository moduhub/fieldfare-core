/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalHost } from '../../env/LocalHost.js';
import { TestNVD } from './TestNVD.js';
import { TestCryptoManager } from './TestCryptoManager.js';
import { VolatileChunkManager } from './TestExports.js';
import { cryptoManager } from '../../basic/CryptoManager.js';
import { setupBasicCollectionTypes } from '../shared/CommonSetup.js';

export * from '../shared/CommonSetup';

export async function setupLocalHost() {
    TestNVD.init();
    VolatileChunkManager.init();
    await TestCryptoManager.init();
    setupBasicCollectionTypes();
    const localKeypair = await cryptoManager.getLocalKeypair();
    await LocalHost.init(localKeypair);
}