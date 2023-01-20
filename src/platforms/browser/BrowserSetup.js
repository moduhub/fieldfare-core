
import {LocalHost} from '../../env/LocalHost';
import {WebCryptoManager} from '../shared/WebCryptoManager';
import {VolatileResourcesManager} from '../../resources/VolatileResourcesManager';
import {IndexedDBResourcesManager} from './IndexedDBResourcesManager';
import {IndexedDBNVD} from './IndexedDBNVD';
import {WebClientTransceiver} from '../shared/WebClientTransceiver';
import {logger} from '../../basic/Log';
import {cryptoManager} from '../../basic/CryptoManager';

export * from '../shared/CommonSetup.js';

export async function setupLocalHost() {
	logger.debug(">> System initHost =========");
	IndexedDBNVD.init();
	VolatileResourcesManager.init();
	IndexedDBResourcesManager.init();
	WebCryptoManager.init();
	const localKeypair = await cryptoManager.getLocalKeypair();
	await LocalHost.init(localKeypair);
	LocalHost.assignWebportTransceiver('ws', new WebClientTransceiver);
	logger.debug('LocalHost ID: ' + LocalHost.getID());
}
