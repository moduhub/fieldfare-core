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

export class RemoteHost {

	constructor(id) {
		this.id = id;
		this.channels = new Set();
		this.definedServices = new Map();
		this.implementedServices = new Map();
		this.pendingRequests = new Map();
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
				logger.warn("Channel offline, removing from list");
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
				var timeSinceLastMessage = Date.now() - this.lastMessageTime;
				logger.log("time since last message: " + timeSinceLastMessage);
				if(timeSinceLastMessage < 10000) {
					return true;
				}
			}
		}
		return false;
	}

	becomeActive() {
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

	async treatMessage(message, channel) {
		this.lastMessageTime = Date.now();
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
				if(await cryptoManager.verifyMessage(message) !== true) {
					throw Error('invalid message signature');
				}
				await localService.pushRequest(this, message);
			}
		} catch(error) {
			logger.log('info', "Message parse failed: " + error);
			logger.error("Message parse failed: " + error.stack);
		}
	}

	async treatAnnounce(message, channel) {
		logger.debug("Received announce message: " + JSON.stringify(message, null, 2));
		if('id' in message.data === false) {
			throw Error('malformed announce, missing host id');
		}
		const remoteHostIdentifier = message.data.id;
		if(this.pubKey === undefined) {
			const chunkIdentifier = HostIdentifier.toChunkIdentifier(remoteHostIdentifier);
			var remotePubKeyChunk = await Chunk.fromIdentifier(chunkIdentifier, remoteHostIdentifier);
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

	async updateEnvironment(uuid, version) {

		const env = LocalHost.getEnvironment(uuid);

		env.updateActiveHost(this, version);

		if(env.version !== version) {

			logger.log('info', "remoteHost: " + this.id + " updated environment to version " + version);

			try {

				await env.update(version, this.id);

				const updatedServicesList = await env.getServicesForHost(this.id);

				await this.updateServices(updatedServicesList);

			} catch (error) {
				logger.log('error', "Failed to update environment to version " + version
					+ ": " + error);
				var iError = error.cause;
				while(iError) {
					logger.log('error', "Cause: " + iError.stack);
					iError = iError.cause;
				}

				console.warn('Blacklisting version ' + version + ' due to update rejection');
				env.versionBlacklist.add(version);

			}
		}

	}

	//Assign callbacks
	onResponseReceived(response) {
		var assignedRequest = LocalHost.getPendingRequest(response.data.id);
		//logger.log('info', "remoteHost.onResponseReceived(" + JSON.stringify(response));
		if(assignedRequest) {
			//logger.log('info', "assignedRequest " + JSON.stringify(assignedRequest));
			if(response.data.error) {
				assignedRequest.reject(response.data.error);
			} else {
				assignedRequest.resolve(response);
			}
		} else {
			logger.warning('Received a response without an assigned request');
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
				var base64data = await ChunkManager.getLocalChunkContents(message.data.id);
				response = new Message('chunk', {
					id: message.data.id,
					data: base64data
				});
			} catch (error) {
				if(error.name === 'NOT_FOUND_ERROR') {
					//not found, generate error response
					response = new Message('chunk', {
						id: message.data.id,
						error: 'not found'
					});
				} else {
					throw Error('treat chunk message failed', {cause: error});
				}
			}
			this.send(response);
		}
	}

	async accessService(uuid) {
		if(this.definedServices.has(uuid) === false) {
			throw Error('Service '+ uuid +' is not defined for this host');
		}
		if(this.implementedServices.has(uuid) === false) {
			try {
				const definition = this.definedServices.get(uuid);
				const newService = RemoteService.fromDefinition(definition);
				newService.setOwner(this);
				this.implementedServices.set(definition.uuid, newService);
				if(this.lastState) {
					const serviceState = this.lastState[uuid];
					newService.setState(serviceState);
				}
				logger.debug('Implemented new RemoteService ' + uuid + ' for RemoteHost ' + this.id);
			} catch(error) {
				throw Error('Failed to setup RemoteService ' + uuid, {cause: error});
			}
		}
		const service = this.implementedServices.get(uuid);
		logger.debug('accessService('+uuid+') result: ' + JSON.stringify(service));
		return service;
	}

};
