
import {LocalHost} from '../../env/LocalHost';
import {ResourcesManager} from '../../resources/ResourcesManager';
import {Environment} from '../../env/Environment';
import {IndexedDBResourcesManager} from './IndexedDBResourcesManager';
import {IndexedDBNVD} from './IndexedDBNVD';
import {WebClientTransceiver} from '../shared/WebClientTransceiver';
import {generatePrivateKey} from '../../basic/keyManagement';
import {NVD} from '../../basic/NVD';
import {logger} from '../../basic/Log';

var webClientTransceiver;

export async function setupLocalHost() {

	logger.debug(">> System initHost =========");

	IndexedDBNVD.init();

	IndexedDBResourcesManager.init();

	var privateKeyData = await NVD.load('privateKey');

	if(privateKeyData === undefined
	|| privateKeyData === null) {
		privateKeyData = await generatePrivateKey();
	}

	await LocalHost.init(privateKeyData);

	webClientTransceiver = new WebClientTransceiver();

	logger.debug('LocalHost ID: ' + LocalHost.getID());

}

export async function bootChannels(list) {

	for(const webport of list) {
		try {
			var wsChannel = await webClientTransceiver.newChannel(webport.address, webport.port);
			LocalHost.bootChannel(wsChannel);
		} catch (error) {
			logger.error("Cannot reach " + webport.address + " at port " + webport.port + ' cause: ' + error);
		}
	}

}

export async function setEnvironmentUUID(uuid) {
	await NVD.save('envUUID', uuid);
}

export async function setupEnvironment() {

	const env = new Environment();

	const envUUID = await NVD.load('envUUID');

	await env.init(envUUID);

	LocalHost.addEnvironment(env);

	logger.debug("Iterating env webports");

	for await (const resource of env.elements.get('webports')) {

		const webport = await ResourcesManager.getResourceObject(resource);

		logger.debug("webport: " + JSON.stringify(webport));

		switch (webport.protocol) {

			case 'ws': {

				try {

					logger.debug('Accessing ws port at ' + webport.address + ':' + webport.port);

					var wsChannel = await webClientTransceiver.newChannel(webport.address, webport.port);

					LocalHost.bootChannel(wsChannel);

				} catch (error) {
					logger.error("Websocket setup failed: " + error);
				}

			} break;

			default: {
				console.log("unsuported webport protocol: " + webport.protocol);
			}
		}
	}

    return env;
}
