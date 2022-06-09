import { HostManager } from '../HostManager';
import { LevelUpNVData } from '../nvd/LevelUpNVData';
import { LevelUpResourcesManager } from '../resources/LevelUpResourcesManager';
import {WebClientTransceiver} from '../WebClientTransceiver';
import {generatePrivateKey} from '../basic/keyManagement';
import { logger } from '../basic/Log';
import { Environment } from '../Environment';

var webClientTransceiver;

export async function setupHost(){

  logger.info("System initHost - React Native");

  global.host = new HostManager();

  global.nvdata = new LevelUpNVData();

  host.addResourcesManager(new LevelUpResourcesManager());

  // check webSetup if needed
  var privateKeyData = await nvdata.load('privateKey');

	if(privateKeyData === undefined
	|| privateKeyData === null) {
		privateKeyData = await generatePrivateKey();
	}

	await host.setupId(privateKeyData);

  webClientTransceiver = new WebClientTransceiver();
}


export async function bootChannels(list){

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

	host.addEnvironment(env);

	logger.debug("Iterating env webports");
  const webports = env.elements.get('webports');

  console.log(JSON.stringify(webports));
  console.log('antes do for await webports:');

  for await (const resource of webports) {
  // for await (const resource of webports) {
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

  console.log('depois webports for await concluido!');
    return env;
}
