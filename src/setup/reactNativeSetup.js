import { HostManager } from '../HostManager';
import { LevelUpNVData } from '../nvd/LevelUpNVData';
import { LevelUpResourcesManager } from '../resources/LevelUpResourcesManager';

import {generatePrivateKey} from '../basic/keyManagement';
import { logger } from '../basic/Log';

var reactNativeClientTransceiver;

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
}


export async function bootChannels(list){

  for (const reactnativeport of list) {
    try {
      var rnsChannel = await reactNativeClientTransceiver.newChannel(reactnativeport.add, reactnativeport.port);
      host.bootChannel(rnsChannel);
    } catch (e) {
      logger.error('Cannot reach ' + reactnativeport.address + ' at port ' + reactnativeport.port + ' cause: ' + e);
    }
  }
}


export async function setupEnvironment(uuid){

  const env = new Environment();

  await env.init(uuid);

  // TODO: implement the environment setup

  host.addEnvironment(env);

  return env;
}
