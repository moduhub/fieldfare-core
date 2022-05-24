/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Utils = require('./basic/Utils.js');

const Message = require('./Message.js');
const RemoteHost = require('./RemoteHost.js');
const Request = require('./Request.js');
const LocalService = require('./env/LocalService.js');

const ResourcesManager = require('./resources/ResourcesManager.js');

import {logger} from './basic/Log';

module.exports = class HostManager {

	constructor() {

		this.bootChannels = new Set();
		this.resourcesManagers = new Set();
		this.remoteHosts = new Map();
		this.requests = new Map();

		this.services = new Map();

		this.environments = new Set();

		this.stateHash = '';

	}

	async setupId(privateKeyData) {

		if(this.resourcesManagers.size == 0) {
			throw Error('Cannot setup ID without a resources manager');
		}

		let pubKeyData;

		if(privateKeyData) {

			this.privateKey = await crypto.subtle.importKey(
				'jwk',
				privateKeyData,
				{
					name:'ECDSA',
					namedCurve: 'P-256'
				},
				false,
				['sign']
			);

			pubKeyData = {
				kty: "EC",
				use: "sig",
				crv: "P-256",
				kid: privateKeyData.kid,
				x: privateKeyData.x,
				y: privateKeyData.y,
				alg: "ES256"
			};

		} else {

			const keypair = await crypto.subtle.generateKey(
				{
					name: "ECDSA",
					namedCurve: "P-256"
				},
				true,
				["sign"]
			);

			this.privateKey = keypair.privateKey;

			pubKeyData = await crypto.subtle.exportKey('jwk', keypair.publicKey);

		}

		// logger.log('info', 'host pubkey data: ' + JSON.stringify(pubKeyData));

		//Calculate host ID from pubkey
		//var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', pubKeyData));

		this.id = await this.storeResourceObject(pubKeyData);

		// logger.log('info', 'HOST ID: ' + this.id);

		setInterval(() => {

			// logger.log('info', "Host is announcing to "
			// 	+ this.remoteHosts.size + " remote hosts and "
			// 	+ this.bootChannels.size + ' boot channels');

			for (const [id,host] of this.remoteHosts) 		this.announce(host);
			for (const channel of this.bootChannels) 	this.announce(channel);

		}, 10000);

	}

	addEnvironment(env) {

		this.environments.add(env);

		// logger.log('info', "Registered enviroments: ");

		for(const env of this.environments) {
			logger.log('info', env.uuid);
		}

	}

	async setupService(definition) {

		var newService = LocalService.fromDefinition(definition);

		//Register service under host mapping
		this.services.set(definition.uuid, newService);

		//recover last service state
        const stateKey = definition.uuid;
        const serviceState = await nvdata.load(stateKey);

		if(serviceState) {
			newService.setState(serviceState);
		} else {
            logger.log('info', "Service state is null, this can be a first setup");
        }

		return newService;
	}

	getLocalService(uuid) {
		return this.services.get(uuid);
	}

	updateState() {

		var hostState = new Object;

		for(const [uuid, service] of this.services) {

			// const serviceName = service.definition.name;
			const serviceState = service.updateState();

			hostState[uuid] = serviceState;

		}

		return hostState;
	}

	registerRemoteHost(hostid) {

		var remoteHost = this.remoteHosts.get(hostid);

		//Check if host exists
		if(remoteHost === undefined) {

			remoteHost = new RemoteHost(hostid);
			this.remoteHosts.set(hostid, remoteHost);

			//Assign callbacks
			remoteHost.onResponseReceived = (response) => {

				var assignedRequest = this.requests.get(response.data.hash);

				//logger.log('info', "remoteHost.onResponseReceived(" + JSON.stringify(response));

				if(assignedRequest) {

					//logger.log('info', "assignedRequest " + JSON.stringify(assignedRequest));

					if(response.data.error) {
						assignedRequest.reject(response.data.error);
					} else {
						assignedRequest.resolve(response);
					}

				}
			};

			remoteHost.onEnvironmentUpdate = async (uuid, version) => {

				for(const env of this.environments) {

					if(env.uuid === uuid) {

						env.updateActiveHost(remoteHost, version);

						if(env.version !== version) {

							logger.log('info', "remoteHost: " + remoteHost.id + " updated environment to version " + version);

							try {

								await env.update(version, remoteHost.id);

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
				}
			}
		}

		return remoteHost;
	}

	async storeResourceObject(object) {

		const base64data = ResourcesManager.convertObjectToData(object);

		var base64hash = await this.storeResource(base64data);

//		logger.log('info', "------------------------------\n"
//			+ "Storing: " + base64hash
//			+ "->" + JSON.stringify(object, null, 2)
//			+ "\n------------------------------\n");

		return base64hash;
	}

	async getResourceObject(hash, owner) {

		const base64data = await this.getResource(hash, owner);

		var object = ResourcesManager.convertDataToObject(base64data);

		return object;
	}

	async storeResource(data) {

		var base64hash;

		if(this.resourcesManagers.size > 0) {

			//Store in all defined managers

			for await (const manager of this.resourcesManagers) {

				base64hash = await manager.storeResource(data);

			}

		} else {
			throw Error('No resources managers defined');
		}

		return base64hash;
	}

	async getResource(hash, owner) {

        ResourcesManager.validateKey(hash);

		var base64data;

		//Attemp to find resource on all resources managers
		for(const manager of this.resourcesManagers) {

			try {

				base64data = await manager.getResource(hash);

				if(base64data !== undefined) {
					return base64data;
				}

			} catch (error) {

				if(error.name === 'NOT_FOUND_ERROR') {
					// logger.log('info', 'Manager ' + manager + ' does not have ' + hash);
				} else {
					throw Error('getResource failed: ', {cause: error});
				}

			}

		}

		//logger.log('info', "res.fetch: Not found locally. Owner: " + owner);

		//not found locally, attemp to find on remote host

		if(owner === null
		|| owner === undefined) {

			//Owner not know, fail
			var error = Error('resource not found locally, owner not known: ' + hash);
			error.name = 'NOT_FOUND_ERROR';
			throw error;

		}

		const retryCount = 3;

		for(var attempts = 0; attempts<retryCount; attempts++) {

			//Check if there is already a request for
			//this same hash
			var request = this.requests.get(hash);

			if(request === undefined) {

				if(attempts > 0) {
					logger.log('info', 'get resource request retry ' + attempts + ' of ' + retryCount-1);
				}

				request = new Request('resource', 10000, {
					hash: hash
				});

				request.setDestinationAddress(owner);

				//send request
				this.requests.set(hash, request);

				//Notify that a new request was created
				this.onNewRequest(request);

			}

			try {

				const response = await request.complete();

				var remoteBase64hash = response.data.hash;
				var remoteBase64data = response.data.data;

				//logger.log 'info', ("Received remote resource response:" + JSON.stringify(response.data.data));
				const verifyHash = await this.storeResource(remoteBase64data);

				if(verifyHash !== remoteBase64hash) {

					//logger.log('info', "[+RES] (" + hash + "):(" + response.data.data + ")");
					throw Error('corrupted resource received from remote host');

				}

				return remoteBase64data;

			} catch (error) {

				// logger.error('info','Get resource request failed: ' + error.stack);

			} finally {

				this.requests.clear(hash);

			}
		}

		throw Error('Resource not found remotely: ' + hash).name = 'NOT_FOUND_ERROR';

	}

	addResourcesManager(manager) {

		this.resourcesManagers.add(manager);

	}

	onNewRequest(request) {

		//logger.log('info', "Forwarding request to request.destination")

		var destinationHost = this.remoteHosts.get(request.destination);

		if(destinationHost != undefined) {

			request.source = this.id;

			destinationHost.send(request);

		} else {

			throw Error('Destination is unknown');

			//TODO: routing here
		}

	}

	async bootChannel(channel) {

		this.bootChannels.add(channel);

		channel.onMessageReceived = (message) => {

			// logger.log('info', "Received message from boot channel: " + JSON.stringify(message));

			if(message.service == 'announce') {

//				logger.log('info', "message.source: " + message.source);
//				logger.log('info', "message.destination: " + message.destination);

				// Reject indirect announce in boot channel
//				if(!message.hasOwnProperty('source')
//				&& !message.hasOwnProperty('destination')) {

					var remoteId = message.data.id;

					// logger.log('info', "Received direct announce from boot channel. Host ID: " + remoteId);

					var remoteHost = this.remoteHosts.get(remoteId);

					//register channel to remote host
					if(remoteHost == undefined) {

						// logger.log('info', "Host was not registered. Creating new... ");

						remoteHost = this.registerRemoteHost(remoteId);

					}

					remoteHost.assignChannel(channel);

					channel.onMessageReceived(message);

					//remove this channel from boot list
					this.bootChannels.clear(channel);

//				} else {
//
//					logger.log('info', "Message is not direct, reject from boot channel:" + JSON.stringify(message));
//				}

			} else {
				// logger.log('info', "Message service not announce! Service: " + message.service);
			}

		};

		//no source nor destination address, direct message
		try {

			this.announce(channel);

		} catch (error) {

			throw Error('Host.bootChannel.send() failed', {cause:error});

		}

	}

	async signMessage(message) {

		if(this.privateKey === undefined) {
			throw Error('failed to sign message, private key undefined');
		}

		var utf8ArrayBuffer = new TextEncoder().encode(JSON.stringify(message.data));

		var signatureBuffer = await crypto.subtle.sign(
			{
				name: "ECDSA",
				hash: {name: "SHA-256"}
			},
			this.privateKey,
			utf8ArrayBuffer);

//		logger.log('info', "Correct Message signature: " + Utils.arrayBufferToBase64(signatureBuffer));
//
//		var bufview = new Uint8Array(signatureBuffer);
//		bufview[1] = 0;

		message.signature = Utils.arrayBufferToBase64(signatureBuffer);

//		logger.log('info', "Message signature added: " + message.signature);
	}

	async announce(destination) {

		if(!destination) {
			throw Error('destination not defined');
		}

		var envVersionGroup;

		if(this.environments.size > 0) {
			envVersionGroup = {};
			for(const env of this.environments) {
				envVersionGroup[env.uuid] = env.version;
			}
		}

		var message = new Message('announce', {
			id: this.id,
			env: envVersionGroup,
			state: this.updateState()
		});

		await this.signMessage(message);

		message.setSourceAddress(this.id);

		if(typeof (destination.send) === 'function') {
			return destination.send(message);
		}

		throw Error('destination ' + JSON.stringify(destination) + ' not send-able');

	}

	async establish(remoteHostID) {

		const remoteHost = this.remoteHosts.get(snapshotProviderID);

		if(remoteHost === undefined
		|| remoteHost === null
		|| remoteHost.isActive() === false) {

			// //attemp connection to webport assigned to this host
			// const webport = await env.getWebport(snapshotProviderID);
			//
			// await host.connectWebport(webport);
			//
			throw Error('function not implemented');

		}

		logger.log('info', "Remote host " + snapshotProviderID + " is active");

		return remoteHost;
	}

};
