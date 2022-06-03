
import {HostManager} from '../HostManager';
import {Environment} from '../Environment';
import {IndexedDBResourcesManager} from '../resources/IndexedDBResourcesManager';
import {IndexedDBNVData} from '../nvd/IndexedDBNVData';
import {WebClientTransceiver} from '../WebClientTransceiver';
import {generatePrivateKey} from '../basic/keyManagement';
import {logger} from '../basic/Log';

var webClientTransceiver;

export async function setupHost() {

	logger.info("System initHost");

	global.host = new HostManager();

	global.nvdata = new IndexedDBNVData();

	host.addResourcesManager(new IndexedDBResourcesManager());

	var privateKeyData = await nvdata.load('privateKey');

	if(privateKeyData === undefined
	|| privateKeyData === null) {
		privateKeyData = await generatePrivateKey();
	}

	await host.setupId(privateKeyData);

	webClientTransceiver = new WebClientTransceiver();

}

export async function bootChannels(list) {

	for(const webport of list) {
		try {
			var wsChannel = await webClientTransceiver.newChannel(webport.address, webport.port);
			host.bootChannel(wsChannel);
		} catch (error) {
			logger.error("Cannot reach " + webport.address + " at port " + webport.port + ' cause: ' + error);
		}
	}

}


export async function setupEnvironment(uuid) {

	const env = new Environment();

	await env.init(uuid);

	logger.debug("Iterating env webports");

	for await (const resource of env.elements.get('webports')) {

		const webport = await host.getResourceObject(resource);

		logger.debug("webport: " + JSON.stringify(webport));

		switch (webport.protocol) {

			case 'ws': {

				try {

					logger.debug('Accessing ws port at ' + webport.address + ':' + webport.port);

					var wsChannel = await webClientTransceiver.newChannel(webport.address, webport.port);

					host.bootChannel(wsChannel);

				} catch (error) {
					logger.error("Websocket setup failed: " + error);
				}

			} break;

			default: {
				console.log("unsuported webport protocol: " + webport.protocol);
			}
		}
	}

	host.addEnvironment(env);

    return env;
}
