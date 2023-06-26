/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Chunk } from '../chunking/Chunk.js';
import { HostIdentifier } from './HostIdentifier.js';
import { Environment } from '../env/Environment.js';
import { LocalService } from './LocalService.js';
import { Collection } from '../structures/Collection.js';
import { RemoteHost } from './RemoteHost.js';
import { Message } from '../trx/Message.js';
import { Utils } from '../basic/Utils.js';
import { logger } from '../basic/Log.js';
import { cryptoManager } from '../basic/CryptoManager.js';
import { EventEmitter } from '../basic/EventEmitter.js';


const localHost = {
	bootChannels: new Set(),
	chunkManagers: new Set(),
	selectedHosts: new Map(),
	requests: new Map(),
	services: new Map(),
	environments: new Set(),
	webportTransceivers: new Map(),
	webportChannels: new Map(),
	events: new EventEmitter()
};

export const LocalHost = {
	/**
	 * Get the host identifier of the local host
	 * @returns {string} Host Identifier
	 */
	getID() {
		return localHost.id;
	},

	get events() {
		return localHost.events;
	},

	async init(keypair) {
		if(keypair === undefined
		|| keypair === null) {
			throw Error('No host keypair defined');
		}
		localHost.keypair = keypair;
		const jwkPubKey = await cryptoManager.exportPublicKey(keypair.publicKey);
		const pubKeyChunk = await Chunk.fromObject(jwkPubKey);
		localHost.id = HostIdentifier.fromChunkIdentifier(pubKeyChunk.id);
		logger.log('info', 'HOST ID: ' + localHost.id);
		localHost.announceInterval = setInterval(async () => {
			// logger.log('info', "Host is announcing to "
			// 	+ localHost.selectedHosts.size + " remote hosts and "
			// 	+ localHost.bootChannels.size + ' boot channels');
			for (const [id,host] of localHost.selectedHosts) {
				// if (host.isActive()) {
					if(host.timeSinceLastAnnounceSent() > 5000
					|| host.timeSinceLastAnnounceSent() === undefined) {
						try {
							await LocalHost.announce(host);
						} catch(error) {
							logger.warn('Announce to ' + id + ' failed' + error);
						}
					}
				// }
			}
			for (const channel of localHost.bootChannels) {
				if(channel.active()) {
					LocalHost.announce(channel);
				} else {
					localHost.bootChannels.delete(channel);
				}
			}
		}, 3000);
	},

	terminate() {
		clearInterval(localHost.announceInterval);
	},

	/**
	 * Implement all services assigned to this host in a given environment.
	 * If this function is called many many times, only new services will be implemented.
	 * @param {*} environment The environment from which service assignments are fetched
	 */
	async implementLocalServices(environment) {
		const serviceArray = await environment.getServicesForHost(localHost.id);
		logger.debug('List of services assigned to host: ' + JSON.stringify(serviceArray));
		for(const serviceUUID of serviceArray) {
			if(!localHost.services.has(serviceUUID)) {
				const newService = await LocalService.implement(serviceUUID, environment);
				localHost.services.set(serviceUUID, newService);
				localHost.events.emit('newService', newService);
			}
		}
	},

	async serveEnvironmentWebports(environment) {
		const servedWebports = await environment.getWebports(LocalHost.getID());
		for(const webport of servedWebports) {
			LocalHost.serveWebport(webport);
		}
		localHost.environments.add(environment);
	},

	/**
	 * Joining the environment means fetching all the services that are assigned to
	 * this host identifier and implementing them by searching the local implementations
	 * registered by LocalService.registerImplementation().
	 * If any implementation is missing, the process will fail by throwing an Error.
	 * The host will also iopen any webport assigned to its Identifier if the webport
	 * implementation is defined locally.
	 * @param {Environment} environment Environment to be joined
	 */
	async join(environment) {
		if(environment === null
		|| environment === undefined
		|| environment instanceof Environment === false) {
			throw Error('Invalid environment object');
		}
		if(localHost.environments.has(environment)) {
			throw Error('Environment already joined before ' + environment.uuid);
		}
		logger.debug('Joining new environment: ' + environment.uuid);
		await this.implementLocalServices(environment);
		environment.events.on('version', () => {
			this.implementLocalServices(environment);
		});
		await this.serveEnvironmentWebports(environment);
	},

	getLocalService(uuid) {
		return localHost.services.get(uuid);
	},

	async selectRemoteHost(remoteHost) {
		if(remoteHost === null) throw Error('Invalid remote host');
		if(remoteHost instanceof RemoteHost === false)  throw Error('Invalid remote host');
		if(localHost.selectedHosts.has(remoteHost.id)) {
			return localHost.selectedHosts.get(remoteHost.id);
		}
		localHost.selectedHosts.set(remoteHost.id, remoteHost);
		// var remoteHost = localHost.selectedHosts.get(hostid);
		// //Check if host exists
		// if(remoteHost === undefined) {
		// 	remoteHost = new RemoteHost(hostid);
		// 	localHost.selectedHosts.set(hostid, remoteHost);
		// 	for(const env of localHost.environments) {
		// 		const servicesList = await env.getServicesForHost(hostid);
		// 		if(servicesList.length > 0) {
		// 			await remoteHost.updateServices(servicesList);
		// 		} else {
		// 			logger.log('info', 'no services assigned to host ' + hostid);
		// 		}
		// 	}
		// }
		// return remoteHost;
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

	popPendingRequest(hash) {
		localHost.requests.delete(hash);
	},

	dispatchRequest(hash, request) {
		// logger.debug("Forwarding request to request.destination: " + JSON.stringify(request.destination));
		if(request.destination === localHost.id) {
			throw Error('Attempt to send a request to localHost');
		}
		if(localHost.requests.has(hash)) {
			throw Error('Duplicate request blocked');
		}
		const destinationHost = RemoteHost.fromHostIdentifier(request.destination);
		localHost.requests.set(hash, request);
		request.source = localHost.id;
		try {
			destinationHost.send(request);
		} catch(error) {
			localHost.requests.delete(hash);
			throw error;
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
					const remoteHostIdentifier = message.data.id;
					const remoteHost = RemoteHost.fromHostIdentifier(remoteHostIdentifier);
					await LocalHost.selectRemoteHost(remoteHost);
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
		const message = new Message('announce', {
			id: localHost.id,
			ts: Date.now(),
			collections: await Collection.getLocalCollectionsStates()
		});
		await cryptoManager.signMessage(message, localHost.keypair.privateKey);
		message.setSourceAddress(localHost.id);
		if(destination) {
			if(destination instanceof RemoteHost) {
				destination.lastAnnounceSent = Date.now();
			}
			if(typeof (destination.send) !== 'function') {
				throw Error('destination ' + JSON.stringify(destination) + ' not send-able');
			}
			return destination.send(message);
		}
		return message;
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
		const webportChunk = await Chunk.fromObject(webportInfo);
		const transceiver = localHost.webportTransceivers.get(webportInfo.protocol);
		if(transceiver === undefined || transceiver === null) {
			throw Error('Unsuported protocol: ' + webportInfo.protocol);
		}
		const channel = localHost.webportChannels.get(webportChunk.id);
		if(channel) {
			if(channel.active()) {
				return channel;
			} else {
				localHost.webportChannels.delete(webportChunk.id);
			}
		}
		const newChannel = await transceiver.newChannel(webportInfo.address, webportInfo.port);
		localHost.webportChannels.set(webportChunk.id, newChannel);
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

	async establish(remoteHost) {
		console.log("Establishing connection with " + remoteHost.id + "...");
		if(remoteHost === undefined) {
			throw Error('remoteHost not defined');
		}
		if(remoteHost instanceof RemoteHost === false) {
			throw Error('remoteHost is not an instance of RemoteHost');
		}
		localHost.selectedHosts.set(remoteHost.id, remoteHost);
		console.log('Establish... selected hosts:', localHost.selectedHosts);
		if(remoteHost.isActive()) {
			logger.debug("Remote host " + remoteHost.id + " is active");
			return remoteHost;
		}
		if(remoteHost.isEstablishing) {
			logger.debug("Remote host " + remoteHost.id + " is already establishing");
			await remoteHost.waitUntilActive();
			return remoteHost;
		}
		remoteHost.isEstablishing = true;
		console.log('establish -> Current remoteHost channels:', remoteHost.channels);
		try {
			for(const env of localHost.environments) {
				const webports = await env.getWebports(remoteHost.id);
				if(!webports) {
					throw Error('no webports found for remote host ' + remoteHost.id);
				}
				for(const webport of webports) {
					try {
						await LocalHost.connectWebport(webport);
						await remoteHost.waitUntilActive();
						remoteHost.isEstablishing = false;
						return remoteHost;
					} catch(error) {
						logger.warn('Connect to webport failed: ' + error);
					}
				}
				throw Error('all webports unreachable');
			}
		} catch(error) {
			remoteHost.isEstablishing = false;
			throw error;
		}
	},

	signMessage(message) {
		logger.debug('LocalHost.signMessage -> key='+JSON.stringify(localHost.keypair));
		return cryptoManager.signMessage(message, localHost.keypair.privateKey);
	}

}
