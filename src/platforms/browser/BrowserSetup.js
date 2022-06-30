
import {LocalHost} from '../../env/LocalHost';
import {ResourcesManager} from '../../resources/ResourcesManager';
import {Environment} from '../../env/Environment';
import {VolatileResourcesManager} from '../../resources/VolatileResourcesManager';
import {IndexedDBResourcesManager} from './IndexedDBResourcesManager';
import {IndexedDBNVD} from './IndexedDBNVD';
import {WebClientTransceiver} from '../shared/WebClientTransceiver';
import {generatePrivateKey} from '../../basic/keyManagement';
import {NVD} from '../../basic/NVD';
import {logger} from '../../basic/Log';

export * from '../shared/CommonSetup.js';

export async function setupLocalHost() {
	logger.debug(">> System initHost =========");
	IndexedDBNVD.init();
	VolatileResourcesManager.init();
	IndexedDBResourcesManager.init();
	var privateKeyData = await NVD.load('privateKey');
	if(privateKeyData === undefined
	|| privateKeyData === null) {
		privateKeyData = await generatePrivateKey();
	}
	await LocalHost.init(privateKeyData);
	LocalHost.assignWebportTransceiver('ws', new WebClientTransceiver);
	logger.debug('LocalHost ID: ' + LocalHost.getID());
}
