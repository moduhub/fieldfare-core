/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {RemoteService} from './env/RemoteService';
import {Message} from './Message';
import {Utils} from './basic/Utils';
import {logger} from './basic/Log';


export class RemoteHost {

	constructor(id) {
		this.id = id;
		this.channels = new Set();
		this.definedServices = new Map();
		this.implementedServices = new Map();
		this.pendingRequests = new Map();
	}

	send(message) {

		if(this.id == undefined) {
			throw Error('undefined remote host address');
		}

		if(this.channels.size == 0) {
			throw Error('no assigned channels');
		}

		message.setDestinationAddress(this.id);

		for(const channel of this.channels) {

			// logger.log('info', "Dispatching message to "
			// 	+ channel.type
			// 	+ ' channel ('
			// 	+ '-'//JSON.stringify(channel.info)
			// 	+ ')');

			channel.send(message);
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

		if(this.lastMessageTime !== undefined
		&& this.lastMessageTime !== null) {

			var timeSinceLastMessage = Date.now() - this.lastMessageTime;

			logger.log("time since last message: " + timeSinceLastMessage);

			if(timeSinceLastMessage < 10000) {
				return true;
			}
		}

		return false;
	}

	async treatMessage(message, channel) {

		this.lastMessageTime = Date.now();

		try {
//		logger.log('info', "Message redirected to "
//			+ this.id + ": "
//			+ JSON.stringify(message));

			if(message.service == 'announce') {

				await this.treatAnnounce(message, channel);

			} else
			if(message.service == 'resource') {

				//logger.log('info', "treating resource message (request/response)");
				await this.treatResourceMessage(message, channel);
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

				const localService = host.getLocalService(message.service);

				if(localService === undefined
				|| localService === null) {
					throw Error('unexpected service id');
				}

				if(await this.verifyMessage(message) !== true) {
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

		logger.log('info', "Received announce message: " + JSON.stringify(message, null, 2));

		if('id' in message.data === false) {
			throw Error('malformed announce, missing host id');
		}

		if(this.pubKey === undefined) {

			//Get host pubkey
			var remotePubKeyData = await host.getResourceObject(message.data.id, message.data.id);

			logger.log('info', "Remote host pubkey: " + JSON.stringify(remotePubKeyData));

			this.pubKey = await crypto.subtle.importKey(
				'jwk',
				remotePubKeyData,
				{
					name:'ECDSA',
					namedCurve: 'P-256'
				},
				false,
				['verify']
			);

		}

		if(await this.verifyMessage(message) !== true) {
			throw Error('invalid message signature');
		}

		//Env update
		if('env' in message.data) {

			for(const uuid in message.data.env) {

				if(Utils.isUUID(uuid) === false) {
					throw Error('Invalid env uuid inside announce');
				}

				const version = message.data.env[uuid];

				if(Utils.isBase64(version) === false) {
					throw Error('Invalid env version inside announce');
				}

				try {
					await this.updateEnvironment(uuid, version);
				} catch(error) {
					logger.error('Environment update failed: ' + error);
				}

			}
		}

		//Get host state
		if('state' in message.data === false) {
			throw Error('malformed announce packet, missing state data');
		}

		if(message.data.state instanceof Object === false) {
			throw Error('Message state object is not an object');
		}

		for(const prop in message.data.state) {
			const service = this.implementedServices.get(prop);
			if(service) {
				service.setState(message.data.state[prop]);
			} else {
				logger.info('Service not implemented: ' + prop);
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

		const env = host.getEnvironment(uuid);
		
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
			}
		}

	}

	//Assign callbacks
	onResponseReceived(response) {

		var assignedRequest = host.requests.get(response.data.hash);

		//logger.log('info', "remoteHost.onResponseReceived(" + JSON.stringify(response));

		if(assignedRequest) {

			//logger.log('info', "assignedRequest " + JSON.stringify(assignedRequest));

			if(response.data.error) {
				assignedRequest.reject(response.data.error);
			} else {
				assignedRequest.resolve(response);
			}

		}
	}

	async treatResourceMessage(message, channel) {

		if('hash' in message.data == false) {
			throw Error('malformed resouce message');
		}

		if('data' in message.data) {

			//this is a response to a previous request
			if(this.onResponseReceived) {

				this.onResponseReceived(message, channel);

			} else {
				throw Error('treatResourceMessage: undefined response callback');
			}

		} else {

			var response;

			try {

				var base64data = await host.getResource(message.data.hash);

				response = new Message('resource', {
					hash: message.data.hash,
					data: base64data
				});

			} catch (error) {

				if(error.name === 'NOT_FOUND_ERROR') {

					//not found, generate error response
					response = new Message('resource', {
						hash: message.data.hash,
						error: 'not found'
					});

				} else {
					throw Error('treat resource message failed', {cause: error});
				}
			}

			this.send(response);

		}
	}

	async verifyMessage(message) {

		var result = false;

		if(this.pubKey === undefined) {
			throw Error('signature verify failed: pubkey undefined');
		}

		if('signature' in message) {

			var signatureBuffer = Utils.base64ToArrayBuffer(message.signature);

			var dataBuffer = Utils.strToUtf8Array(JSON.stringify(message.data));

			result = await crypto.subtle.verify(
				{
					name: "ECDSA",
					hash: {name: "SHA-256"}
				},
				this.pubKey,
				signatureBuffer,
				dataBuffer);

			logger.log('info', "Signature verify result: " + result);

		} else {
			logger.log('info', 'missing signature inside message: ' + JSON.stringify(message));
		}

		return result;
	}

	async accessService(uuid) {

		if(this.definedServices.has(uuid) === false) {
			throw Error('Service '+ uuid +' is not defined for this host');
		}

		if(this.implementedServices.has(uuid) === false) {
			try {
				const definition = this.definedServices.get(uuid);
				const newService = RemoteService.fromDefinition(definition);
				newService.owner = this;
				this.implementedServices.set(definition.uuid, newService);
				logger.info('Implemented new RemoteService ' + uuid + ' for RemoteHost ' + this.id);
			} catch(error) {
				throw Error('Failed to setup RemoteService ' + uuid, {cause: error});
			}
		}

		const service = this.implementedServices.get(uuid);

		logger.info('accessService('+uuid+') result: ' + JSON.stringify(service));

		return service;
	}

};
