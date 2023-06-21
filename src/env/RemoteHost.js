/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalHost } from '../env/LocalHost.js';
import { Chunk } from '../chunking/Chunk.js';
import { ChunkManager } from '../chunking/ChunkManager.js';
import { RemoteService } from './RemoteService.js';
import { Message } from '../trx/Message.js';
import { Utils } from '../basic/Utils.js';
import { logger } from '../basic/Log.js';
import { cryptoManager } from '../basic/CryptoManager.js';
import { HostIdentifier } from './HostIdentifier.js';
import { Collection } from '../structures/Collection.js';
import { EventEmitter } from '../basic/EventEmitter.js';
import { ServiceDescriptor } from './ServiceDescriptor.js';

const gOnlineHosts = new Map;
const gOfflineHosts = new Map;
const gRemoteHostsEvents = new EventEmitter;
let gActivityTimeout = undefined;

export class RemoteHost {

	constructor(id) {
		this.id = id;
		this.channels = new Set();
		this.definedServices = new Map();
		this.implementedServices = new Map();
		this.pendingRequests = new Map();
	}

	static on(...args) {
		return gRemoteHostsEvents.on(...args);
	}

	static removeEventListener(handle) {
		return gRemoteHostsEvents.removeEventListener(handle);
	}

	static getOnlineHosts() {
		return gOnlineHosts;
	}

	static fromHostIdentifier(hostIdentifier) {
		let remoteHost = gOnlineHosts.get(hostIdentifier);
		if(!remoteHost) {
			remoteHost = gOfflineHosts.get(hostIdentifier);
			if(!remoteHost) {
				remoteHost = new RemoteHost(hostIdentifier);
				gOfflineHosts.set(hostIdentifier, remoteHost);
			}
		}
		return remoteHost;
	}

	static updateRemoteHostsActivity() {
		for(const [hostIdentifier, remoteHost] of gOnlineHosts) {
			if(!remoteHost.isActive()) {
				gOfflineHosts.set(hostIdentifier, remoteHost);
				gOnlineHosts.delete(hostIdentifier);
				gRemoteHostsEvents.emit('offline', remoteHost);
				logger.debug(hostIdentifier + ' is offline');
			}
		}
	}

	async send(message) {
		if(this.id == undefined) {
			throw Error('undefined remote host address');
		}
		if(this.channels.size == 0) {
			throw Error('no assigned channels');
		}
		message.setDestinationAddress(this.id);
		for(const channel of this.channels) {
			var killFlag = false;
			if(channel.active()) {
				try {
					await channel.send(message);
				} catch(error) {
					killFlag = true;
				}
			} else {
				killFlag = true;
			}
			if(killFlag) {
				logger.debug("Channel offline, removing from list");
				this.channels.delete(channel);
			}
		}
	}

	assignChannel(channel) {
		this.channels.add(channel);
		channel.onMessageReceived = (message) => {
			this.treatMessage(message, channel);
		};
		logger.log('info', "Assigning channel to " + this.id
			+ ". Now there are " + this.channels.size
			+ " channels assigned to this remote host.");
	}

	timeSinceLastAnnounceSent() {
		if(this.lastAnnounceSent) {
			return Date.now() - this.lastAnnounceSent;
		}
		return undefined;
	}

	isActive() {
		var numActiveChannels = 0;
		for(const channel of this.channels) {
			if(channel.active()) {
				numActiveChannels++;
			}
		}
		if(numActiveChannels > 0) {
			if(this.lastMessageTime !== undefined
			&& this.lastMessageTime !== null) {
				const timeSinceLastMessage = Date.now() - this.lastMessageTime;
				if(timeSinceLastMessage < 10000) {
					return true;
				}
			}
		}
		return false;
	}

	waitUntilActive() {
		if(this.isActive() === false) {
			return new Promise((resolve, reject) => {
				var count = 0;
				const interval = setInterval(() => {
					if(this.isActive()){
						clearInterval(interval);
						resolve();
					}
					if(++count > 10) {
						clearInterval(interval);
						reject(new Error('become active timeout'));
					}
				}, 1000);
			});
		}
	}

	updateActivity() {
		this.lastMessageTime = Date.now();
		if(this.id) {
			if(!gActivityTimeout) {
				gActivityTimeout = setInterval(() => {
					RemoteHost.updateRemoteHostsActivity();
				}, 1000);
			}
			if(!gOnlineHosts.has(this.id)) {
				gOfflineHosts.delete(this.id);
				gOnlineHosts.set(this.id, this);
				gRemoteHostsEvents.emit('online', this);
				logger.debug(this.id + ' is online');
			}
		}
	}

	async treatMessage(message, channel) {
		try {
			if(message.service == 'announce') {
				await this.treatAnnounce(message, channel);
			} else
			if(message.service == 'chunk') {
				await this.treatChunkMessage(message, channel);
			} else
			if(message.service == 'response') {
				if('hash' in message.data === false) {
					throw Error('Malformed reponse data');
				}
				if(this.pendingRequests.has(message.data.hash)) {
					const request = this.pendingRequests.get(message.data.hash);
					request.resolve(message);
				} else {
					throw Error('Response does not have an assigned request');
				}
			} else {
				const localService = LocalHost.getLocalService(message.service);
				if(localService === undefined
				|| localService === null) {
					throw Error('unexpected service id: ' + message.service);
				}
				if(await cryptoManager.verifyMessage(message, this.pubKey) !== true) {
					throw Error('invalid message signature');
				}
				await localService.pushRequest(this, message);
			}
			this.updateActivity();
		} catch(error) {
			logger.log('info', "Message parse failed: " + error);
			logger.error("Message parse failed: " + error.stack);
		}
	}

	async treatAnnounce(message, channel) {
		if('id' in message.data === false) {
			throw Error('malformed announce, missing host id');
		}
		const remoteHostIdentifier = message.data.id;
		if(this.pubKey === undefined) {
			const chunkIdentifier = HostIdentifier.toChunkIdentifier(remoteHostIdentifier);
			var remotePubKeyChunk = Chunk.fromIdentifier(chunkIdentifier, remoteHostIdentifier);
			await remotePubKeyChunk.clone(0);
			const remotePubKeyJWK = await remotePubKeyChunk.expand();
			logger.log('info', "Remote host pubkey: " + JSON.stringify(remotePubKeyJWK));
			this.pubKey = await cryptoManager.importPublicKey(remotePubKeyJWK);
		}
		if(await cryptoManager.verifyMessage(message, this.pubKey) !== true) {
			throw Error('invalid message signature');
		}
		if('collections' in message.data) {
			for(const uuid in message.data.collections) {
				if(!Utils.isUUID(uuid)) {
					throw Error('invalid collection uuid');
				}
				const state = message.data.collections[uuid];
				Collection.updateRemoteCollection(remoteHostIdentifier, uuid, state);
			}
		}
		if(this.timeSinceLastAnnounceSent() > 5000) {
			await LocalHost.announce(this);
		}
	}

	updateServices(serviceList) {
		for(const definition of serviceList) {
			if(this.definedServices.has(definition.uuid) === false) {
				this.definedServices.set(definition.uuid, definition);
				// logger.info('New service defined for host ' + this.id
				// 	+ ': serviceUUID: ' + definition.uuid);
			}
		}
		// logger.log('info', this.id + ' services update:' + JSON.stringify(this.services));
	}

	onResponseReceived(response) {
		const assignedRequest = LocalHost.getPendingRequest(response.data.id);
		if(!assignedRequest) {
			throw Error('Stray response message: ' + JSON.stringify(response.data.id));
		}
		if(response.data.error) {
			assignedRequest.reject(response.data.error);
		} else {
			assignedRequest.resolve(response);
		}
	}

	async treatChunkMessage(message, channel) {
		if('id' in message.data == false) {
			throw Error('malformed resouce message');
		}
		if('data' in message.data
		|| 'error' in message.data) {
			//this is a response to a previous request
			if(this.onResponseReceived) {
				this.onResponseReceived(message, channel);
			} else {
				throw Error('treatChunkRequest: undefined response callback');
			}
		} else {
			var response;
			try {
				const {base64data} = await ChunkManager.getLocalChunkContents(message.data.id);
				response = new Message('chunk', {
					id: message.data.id,
					data: base64data
				});
			} catch (error) {
				if(error.name === 'NOT_FOUND_ERROR') {
					//not found, generate error response
					response = new Message('chunk', {
						id: message.data.id,
						error: 'NOT_FOUND'
					});
				} else {
					throw Error('treat chunk message failed', {cause: error});
				}
			}
			this.send(response);
		}
	}

	async accessService(descriptor) {
		ServiceDescriptor.validate(descriptor);
		if(this.implementedServices.has(descriptor.uuid) === false) {
			try {
				const newService = RemoteService.fromDescriptor(descriptor);
				newService.setOwner(this);
				newService.collection = await Collection.getRemoteCollection(this.id, descriptor.uuid);
				this.implementedServices.set(descriptor.uuid, newService);
				logger.debug('Implemented new RemoteService ' + descriptor.uuid + ' for RemoteHost ' + this.id);
				return newService;
			} catch(error) {
				throw Error('Failed to setup RemoteService ' + descriptor.uuid, {cause: error});
			}
		}
		const service = this.implementedServices.get(descriptor.uuid);
		logger.debug('accessService('+descriptor.uuid+') result: ' + JSON.stringify(service));
		return service;
	}

};
