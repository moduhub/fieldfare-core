/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Utils = require('./basic/Utils.js');

const Message = require('./Message.js');
const RemoteHost = require('./RemoteHost.js');
const Request = require('./Request.js');
const Service = require('./env/Service.js');

const ResourcesManager = require('./resources/ResourcesManager.js');


module.exports = class HostManager {

	constructor() {

		this.bootChannels = new Set();
		this.resourcesManagers = new Set();
		this.remoteHosts = new Map();
		this.requests = new Map();

		this.services = new Map();

		this.stateHash = '';

	}

	async setupId(privateKeyData) {

		if(this.resourcesManagers.size == 0) {
			throw 'Cannot setup ID without a resources manager';
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

		console.log('host pubkey data: ' + JSON.stringify(pubKeyData));

		//Calculate host ID from pubkey
		//var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', pubKeyData));

		this.id = await this.storeResourceObject(pubKeyData);

		console.log('host id: ' + this.id);

		setInterval(() => {
			//console.log("Host is announcing");
			for (const [id,host] of this.remoteHosts) 		this.announce(host);
			for (const channel of this.bootChannels) 	this.announce(channel);
		}, 10000);

	}

	async setupService(definition) {

		var newService = Service.fromDefinition(definition);

		//Register service under host mapping
		this.services.set(definition.uuid, newService);

		//recover last service state
        const stateKey = definition.uuid;
        const serviceState = await nvdata.load(stateKey);

		if(serviceState) {
			newService.setState(serviceState);
		} else {
            console.log("Service state is null, this can be a first setup");
        }

		return newService;
	}

	updateState() {

		var hostState = new Object;

		for(const [uuid, service] of this.services) {

			const serviceName = service.name;
			const serviceState = service.getState();

			hostState[serviceName] = serviceState;

			console.log("Storing service state " + uuid + '->' + JSON.stringify(serviceState));
			nvdata.save(uuid, serviceState);
		}

		return hostState;
	}

	registerRemoteHost(hostid) {

		var remoteHost = this.remoteHosts.get(hostid);

		//Check if host existed
		if(remoteHost === undefined) {

			remoteHost = new RemoteHost(hostid);
			this.remoteHosts.set(hostid, remoteHost);

			//Assign callbacks
			remoteHost.onResponseReceived = (response) => {

				var assignedRequest = this.requests.get(response.data.hash);

				//console.log("remoteHost.onResponseReceived(" + JSON.stringify(response));

				if(assignedRequest) {

					//console.log("assignedRequest " + JSON.stringify(assignedRequest));

					if(response.data.error) {
						assignedRequest.reject(response.data.error);
					} else {
						assignedRequest.resolve(response);
					}

				}
			};

			remoteHost.onEnvironmentUpdate = (version) => {

				console.log("remoteHost: " + remoteHost.id + " updated environment to version " + version);

				if(this.environment) {
					this.environment.update(version, remoteHost.id);
				}

			}
		}

		return remoteHost;
	}

	async storeResourceObject(object) {

		const base64data = ResourcesManager.convertObjectToData(object);

		var base64hash = await this.storeResource(base64data);

//		console.log("------------------------------\n"
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
			throw 'No resources managers defined';
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
					console.log('Manager ' + manager + ' does not have ' + hash);
				} else {
					throw Error('getResource failed: ', {cause: error});
				}

			}

		}

		//console.log("res.fetch: Not found locally. Owner: " + owner);

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
					console.log('get resource request retry ' + attempts + ' of ' + retryCount-1);
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

				//console.log ("Received remote resource response:" + JSON.stringify(response.data.data));
				const verifyHash = await this.storeResource(remoteBase64data);

				if(verifyHash !== remoteBase64hash) {

					//console.log("[+RES] (" + hash + "):(" + response.data.data + ")");
					throw Error('corrupted resource received from remote host');

				}

				return remoteBase64data;

			} catch (error) {

				console.error('Get resource request failed: ' + error.stack);

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

		//console.log("Forwarding request to request.destination")

		var destinationHost = this.remoteHosts.get(request.destination);

		if(destinationHost != undefined) {

			request.source = this.id;

			destinationHost.send(request);

		} else {

			console.log("Error: Destination is unknown");

			//TODO: routing here
		}

	}

	async bootChannel(channel) {

		this.bootChannels.add(channel);

		this.announce(channel);

		channel.onMessageReceived = (message) => {

			console.log("Received message from boot channel: " + JSON.stringify(message));

			if(message.service == 'announce') {

//				console.log("message.source: " + message.source);
//				console.log("message.destination: " + message.destination);

				// Reject indirect announce in boot channel
//				if(!message.hasOwnProperty('source')
//				&& !message.hasOwnProperty('destination')) {

					var remoteId = message.data.id;

					console.log("Received direct announce from boot channel. Host ID: " + remoteId);

					var remoteHost = this.remoteHosts.get(remoteId);

					//register channel to remote host
					if(remoteHost == undefined) {

						console.log("Host was not registered. Creating new... ");

						remoteHost = this.registerRemoteHost(remoteId);

					}

					remoteHost.assignChannel(channel);

					channel.onMessageReceived(message);

					//remove this channel from boot list
					this.bootChannels.clear(channel);

//				} else {
//
//					console.log("Message is not direct, reject from boot channel:" + JSON.stringify(message));
//				}

			} else {
				console.log("Message service not announce! Service: " + message.service);
			}

		};

		//no source nor destination address, direct message
		try {

			channel.send(announceMessage);

		} catch (error) {

			console.log('Host.bootChannel.send() failed: ' + error);

		}

	}

	async signMessage(message) {

		if(this.privateKey === undefined) {
			throw 'failed to sign message, private key undefined';
		}

		var utf8ArrayBuffer = new TextEncoder().encode(JSON.stringify(message.data));

		var signatureBuffer = await crypto.subtle.sign(
			{
				name: "ECDSA",
				hash: {name: "SHA-256"}
			},
			this.privateKey,
			utf8ArrayBuffer);

//		console.log("Correct Message signature: " + Utils.arrayBufferToBase64(signatureBuffer));
//
//		var bufview = new Uint8Array(signatureBuffer);
//		bufview[1] = 0;

		message.signature = Utils.arrayBufferToBase64(signatureBuffer);

//		console.log("Message signature added: " + message.signature);
	}

	async announce(destination) {

		if(!destination) {
			throw Error('destination not defined');
		}

		var envVersion;

		if(this.environment) {
			envVersion = this.environment.version;
		}

		var message = new Message('announce', {
			id: this.id,
			env: envVersion,
			state: this.updateState()
		});

		await this.signMessage(message);

		message.setSourceAddress(this.id);

		if(typeof (destination.send) === 'function') {
			return destination.send(message);
		}

		throw Error('destination ' + JSON.stringify(destination) + ' not send-able');

	}

};
