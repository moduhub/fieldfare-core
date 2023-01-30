
import {LocalHost} from '../../env/LocalHost';
import {BrowserCryptoManager} from './BrowserCryptoManager';
import {VolatileChunkManager} from '../../chunking/VolatileChunkManager';
import {IndexedDBChunkManager} from './IndexedDBChunkManager';
import {IndexedDBNVD} from './IndexedDBNVD';
import {WebClientTransceiver} from '../shared/WebClientTransceiver';
import {logger} from '../../basic/Log';
import {cryptoManager} from '../../basic/CryptoManager';

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
