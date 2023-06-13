/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {
    LocalHost, cryptoManager, Collection, VolatileChunkManager,
    ChunkList, ChunkSet, ChunkMap
} from '../../src';
import { TestNVD } from './TestNVD.js';
import { TestCryptoManager } from './TestCryptoManager.js';

export { TestNVD, TestCryptoManager };

export function terminate() {
    LocalHost.terminate();
}

export function setupBasicCollectionTypes() {
    Collection.registerType('list', ChunkList);
    Collection.registerType('set', ChunkSet);
    Collection.registerType('map', ChunkMap);
}

export async function init() {
    TestNVD.init();
    VolatileChunkManager.init();
    await TestCryptoManager.init();
    setupBasicCollectionTypes();
    const localKeypair = await cryptoManager.getLocalKeypair();
    await LocalHost.init(localKeypair);
}
