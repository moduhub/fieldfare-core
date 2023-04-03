/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {LocalHost} from '../../env/LocalHost.js';
import {BrowserCryptoManager} from './BrowserCryptoManager.js';
import {VolatileChunkManager} from '../../chunking/VolatileChunkManager.js';
import {IndexedDBChunkManager} from './IndexedDBChunkManager.js';
import {IndexedDBNVD} from './IndexedDBNVD.js';
import {WebClientTransceiver} from '../shared/WebClientTransceiver.js';
import {logger} from '../../basic/Log.js';
import {cryptoManager} from '../../basic/CryptoManager.js';

export * from '../shared/CommonSetup.js';

export async function setupLocalHost() {
	logger.debug(">> System initHost =========");
	IndexedDBNVD.init();
	VolatileChunkManager.init();
	IndexedDBChunkManager.init();
	BrowserCryptoManager.init();
	const localKeypair = await cryptoManager.getLocalKeypair();
	await LocalHost.init(localKeypair);
	LocalHost.assignWebportTransceiver('ws', new WebClientTransceiver);
	logger.debug('LocalHost ID: ' + LocalHost.getID());
}
