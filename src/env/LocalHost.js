/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2022 Adan Kvitschal
 * ISC LICENSE
 */

import {ResourcesManager} from '../resources/ResourcesManager';
import {cryptoManager} from '../basic/CryptoManager';
import {Environment} from '../env/Environment';
import {LocalService} from './LocalService';
import {RemoteHost} from './RemoteHost';
import {Message} from '../trx/Message';
import {Request} from '../trx/Request';
import {NVD} from '../basic/NVD';
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';

export const localHost = {
	bootChannels: new Set(),
	resourcesManagers: new Set(),
	remoteHosts: new Map(),
	requests: new Map(),
	services: new Map(),
	environments: new Set(),
	webportTransceivers: new Map(),
	webportChannels: new Map(),
	stateHash: ''
};


export const LocalHost = {

	getID() {
		return localHost.id;
	},

	async init(keypair) {
		if(ResourcesManager.available() === false) {
			throw Error('Cannot setup ID without a resources manager');
		}
		if(keypair === undefined
		|| keypair === null) {
			throw Error('No host private key defined');
		}
		this.keypair = keypair;
		const jwkPubKey = await cryptoManager.exportPublicKey(keypair.publicKey);
		logger.log('jwkPubKey: ' + JSON.stringify(jwkPubKey))
		localHost.id = await ResourcesManager.storeResourceObject(jwkPubKey);
		logger.log('info', 'HOST ID: ' + localHost.id);
		setInterval(async () => {
			// logger.log('info', "Host is announcing to "
			// 	+ localHost.remoteHosts.size + " remote hosts and "
			// 	+ localHost.bootChannels.size + ' boot channels');
			for (const [id,host] of localHost.remoteHosts) {
				if (host.isActive()) {
					try {
						await LocalHost.announce(host);
					} catch(error) {
						logger.warn('Announce to ' + id + ' failed' + error);
					}
				}
			}
			for (const channel of localHost.bootChannels) {
				if(channel.active()) {
					LocalHost.announce(channel);
				} else {
					localHost.bootChannels.delete(channel);
				}
			}
		}, 10000);
	},

	addEnvironment(env) {
		if(env === null
		|| env === undefined
		|| env instanceof Environment === false) {
			throw Error('Invalid environment object');
		}
		if(localHost.environments.has(env) === false) {
			localHost.environments.add(env);
			logger.debug('New env registered: ' + env.uuid);
		} else {
			logger.warn('Env already registered ' + env.uuid);
		}
	},

	async setupService(definition) {
		var newService = LocalService.fromDefinition(definition);
		//Register service under host mapping
		localHost.services.set(definition.uuid, newService);
		//recover last service state
        const stateKey = definition.uuid;
        const serviceState = await NVD.load(stateKey);
		if(serviceState) {
			newService.setState(serviceState);
		} else {
            logger.log('info', "Service state is null, localHost can be a first setup");
        }
		return newService;
	},

	getLocalService(uuid) {
		return localHost.services.get(uuid);
	},

	updateState() {
		var hostState = new Object;
		for(const [uuid, service] of localHost.services) {
			// const serviceName = service.definition.name;
			const serviceState = service.updateState();
			hostState[uuid] = serviceState;
		}
		return hostState;
	},

	async registerRemoteHost(hostid) {
		var remoteHost = localHost.remoteHosts.get(hostid);
		//Check if host exists
		if(remoteHost === undefined) {
			remoteHost = new RemoteHost(hostid);
			localHost.remoteHosts.set(hostid, remoteHost);
			for(const env of localHost.environments) {
				const servicesList = await env.getServicesForHost(hostid);
				if(servicesList.length > 0) {
					await remoteHost.updateServices(servicesList);
				} else {
					logger.log('info', 'no services assigned to host ' + hostid);
				}
			}
		}
		return remoteHost;
	},

	getEnvironment(uuid) {
		for(const env of localHost.environments) {
			if(env.uuid === uuid) {
				return env;
			}
		}
		return null;
	},

	getPendingRequest(hash) {
		return localHost.requests.get(hash);
	},

	clearRequest(hash) {
		localHost.requests.clear(hash);
	},

	dispatchRequest(hash, request) {
		// logger.debug("Forwarding request to request.destination: " + JSON.stringify(request.destination));
		localHost.requests.set(hash, request);
		var destinationHost = localHost.remoteHosts.get(request.destination);
		if(destinationHost != undefined) {
			request.source = localHost.id;
			destinationHost.send(request);
		} else {
			throw Error('dispatchRequest failed: destination is unknown');
			//TODO: routing here
		}
	},

	async bootChannel(channel) {
		localHost.bootChannels.add(channel);
		channel.onMessageReceived = async (message) => {
			//logger.debug("Received message from boot channel: " + JSON.stringify(message));
			if(message.service === 'announce') {
//				logger.log('info', "message.source: " + message.source);
//				logger.log('info', "message.destination: " + message.destination);
				// Reject indirect announce in boot channel
//				if(!message.hasOwnProperty('source')
//				&& !message.hasOwnProperty('destination')) {
					var remoteId = message.data.id;
					// logger.log('info', "Received direct announce from boot channel. Host ID: " + remoteId);
					var remoteHost = localHost.remoteHosts.get(remoteId);
					//register channel to remote host
					if(remoteHost === undefined) {
						// logger.log('info', "Host was not registered. Creating new... ");
						remoteHost = await LocalHost.registerRemoteHost(remoteId);
					}
					remoteHost.assignChannel(channel);
					channel.onMessageReceived(message);
					//remove localHost channel from boot list
					localHost.bootChannels.delete(channel);
//				} else {
//					logger.log('info', "Message is not direct, reject from boot channel:" + JSON.stringify(message));
//				}
			} else {
				// logger.log('info', "Message service not announce! Service: " + message.service);
			}
		};
		//no source nor destination address, direct message
		try {
			LocalHost.announce(channel);
		} catch (error) {
			throw Error('Host.bootChannel.send() failed', {cause:error});
		}
	},

	async announce(destination) {
		if(!destination) {
			throw Error('destination not defined');
		}
		var envVersionGroup;
		if(localHost.environments.size > 0) {
			envVersionGroup = {};
			for(const env of localHost.environments) {
				envVersionGroup[env.uuid] = env.version;
			}
		}
		var message = new Message('announce', {
			id: localHost.id,
			env: envVersionGroup,
			state: LocalHost.updateState()
		});
		await cryptoManager.signMessage(message, localHost.privateKey);
		message.setSourceAddress(localHost.id);
		if(typeof (destination.send) !== 'function') {
			throw Error('destination ' + JSON.stringify(destination) + ' not send-able');
		}
		return destination.send(message);
	},

	assignWebportTransceiver(protocol, transceiver) {
		localHost.webportTransceivers.set(protocol, transceiver);
	},

	async connectWebport(webportInfo) {
		try {
			Utils.validateParameters(webportInfo, ['protocol', 'address', 'port', 'hostid']);
		} catch(error) {
			//Accept both forms
			Utils.validateParameters(webportInfo, ['protocol', 'address', 'port']);
		}
		const webportKey = await ResourcesManager.generateKeyForObject(webportInfo);
		const transceiver = localHost.webportTransceivers.get(webportInfo.protocol);
		if(transceiver === undefined || transceiver === null) {
			throw Error('Unsuported protocol: ' + webportInfo.protocol);
		}
		const channel = localHost.webportChannels.get(webportKey);
		if(channel) {
			if(channel.active()) {
				return channel;
			} else {
				localHost.webportChannels.delete(webportKey);
			}
		}
		const newChannel = await transceiver.newChannel(webportInfo.address, webportInfo.port);
		localHost.webportChannels.set(webportKey, newChannel);
		LocalHost.bootChannel(newChannel);
		return newChannel;
	},

	async serveWebport(webportInfo) {
		try {
			Utils.validateParameters(webportInfo, ['protocol', 'address', 'port', 'hostid']);
		} catch(error) {
			//Accept both forms
			Utils.validateParameters(webportInfo, ['protocol', 'address', 'port']);
		}
		const transceiver = localHost.webportTransceivers.get(webportInfo.protocol);
		if(transceiver === undefined || transceiver === null) {
			throw Error('Unsuported protocol');
		}
		transceiver.onNewChannel = (newChannel) => {
			logger.debug('[Served Webport] onNewChannel');
			LocalHost.bootChannel(newChannel);
		};
		await transceiver.serve(webportInfo.address, webportInfo.port);
	},

	async establish(remoteHostID) {
		logger.debug("host.establish: " + remoteHostID);
		var remoteHost = localHost.remoteHosts.get(remoteHostID);
		if(remoteHost === undefined
		|| remoteHost === null) {
			remoteHost = await LocalHost.registerRemoteHost(remoteHostID);
		}
		if(remoteHost.isActive() === false) {
			for(const env of localHost.environments) {
				const webports = await env.getWebports(remoteHostID);
				for(const webport of webports) {
					try {
						await LocalHost.connectWebport(webport);
						await remoteHost.becomeActive();
						return remoteHost;
					} catch(error) {
						logger.warn('Connect to webport failed: ' + error);
					}
				}
				throw Error('all webports unreachable');
			}
		}
		logger.log('info', "Remote host " + remoteHostID + " is active");
		return remoteHost;
	}

}
