/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Utils = require('./basic/Utils.js');

const Message = require('./Message.js');
const RemoteHost = require('./RemoteHost.js');
const Request = require('./Request.js');

const ResourcesManager = require('./resources/ResourcesManager.js');

const HashLinkedList = require('./structures/HashLinkedList.js');

module.exports = class HostManager {

	constructor() {

		this.bootChannels = new Set();
		this.resourcesManagers = new Set();
		this.remoteHosts = new Map();
		this.envAdmins = new Set();
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
			this.announce();
		}, 10000);

	}

	async setupService(definition) {

		var newService = {
			definition: definition,
			methods: [],
			data: new Object
		};

		//recover last service state
		const stateKey = definition.uuid;
		const serviceState = await nvdata.load(stateKey);

		if(serviceState) {
			console.log("Service state is null, this can be a first setup");
		}

		for(const entry of definition.data) {

			console.log("Processing entry " + JSON.stringify(entry));

			switch(entry.type) {

				case 'list' : {

					var newList;
					if(serviceState) {
						const entryState = serviceState[entry.name];
						console.log("entry state: " + entryState);

						newList = new HashLinkedList(entryState);
					} else {
						newList = new HashLinkedList();
					}

					newList.name = entry.name; //is this a bad practice?

					newService.data[entry.name] = newList;

				} break;

				default: {
					throw 'unknown service data type: ' + entry.type;
				} break;
			}

		}

		//Register service under host mapping
		this.services.set(definition.uuid, newService);

		return newService;
	}

	updateState() {

		var hostState = new Object;

		for(const [uuid, service] of this.services) {

			const serviceName = service.definition.name;
			var serviceState = new Object;

			for(const prop in service.data) {

				console.log("data.name: " + prop);
				console.log("stateId: " + service.data[prop].getStateIdentifier());
			 	serviceState[prop] = service.data[prop].getStateIdentifier();
			}

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
			remoteHost.requestLocalResource = async (hash) => {

				//console.log("remoteHost.requestLocalResource(" + hash);

				var base64data = await this.getResource(hash);

				//console.log("rsource result: " + base64data);

				return base64data;
			};

			remoteHost.onResponseReceived = (response) => {

				var assignedRequest = this.requests.get(response.data.hash);

				//console.log("remoteHost.onResponseReceived(" + JSON.stringify(response));

				if(assignedRequest) {

					//console.log("assignedRequest " + JSON.stringify(assignedRequest));

					assignedRequest.complete(response);
				}
			};
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

	getResource(hash, owner) {

		return new Promise((resolve, reject) => {

			//Attemp to find resource on all resources managers
			var iterator = this.resourcesManagers.values();

			var result = iterator.next();
			while(!result.done) {

				var iManager = result.value;

				var base64data = iManager.getResource(hash);

				if(base64data !== undefined) {
					resolve(base64data);
					break;
				}

				var result = iterator.next();
			}

			if(base64data == undefined) {

				//console.log("res.fetch: Not found locally. Owner: " + owner);

				//not found locally, attemp to find on remote host

				if(owner
				&& owner !== null
				&& owner !== undefined) {

					//Check if there is already a request for
					//this same hash

					//console.log("res.fetch: looking for previous request");

					var request = this.requests.get(hash);

					//console.log("res.fetch: previous request = " + request);

					if(request == undefined) {

						//console.log("res.fetch: new request");

						request = new Request('resource', 10000, {
							hash: hash
						});

						request.setDestinationAddress(owner);

						//send request
						this.requests.set(hash, request);

					}

					//Listen for request completion
					request.addListener((response, error) => {

						if(error
						&& error !== null
						&& error !== undefined) {

							//console.log("get resource rejected: timeout");

							reject(error);

						} else {

							var remoteBase64hash = response.data.hash;
							var remoteBase64data = response.data.data;

							//console.log ("Received remote resource response:" + JSON.stringify(response.data.data));
							this.storeResource(remoteBase64data).then( (hash) => {

								if(hash === remoteBase64hash) {

									//console.log("[+RES] (" + hash + "):(" + response.data.data + ")");

									resolve(response.data.data);

								} else {

									reject('corrupted resource received from remote host');

								}


							})

						}

					});

					//Notify that a new request was created
					this.onNewRequest(request);

				} else {

					//console.log("get resource: rejected no owner");

					//Owner not know, fail
					reject("resource not found: " + hash);

				}

			}
		});

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

		var announceMessage = new Message('announce', {
			id: this.id,
			state: this.stateHash,
			env: this.envVersion
		});

		await this.signMessage(announceMessage);

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

	announce() {

		//Announce to everybody I know!
		if(this.remoteHosts.size > 0) {

			//console.log("Announcing to " + this.remoteHosts.size + " known hosts");

			this.remoteHosts.forEach(async host => {

				var message = new Message('announce', {
					id: this.id,
					state: this.updateState()
				});

				await this.signMessage(message);

				message.setSourceAddress(this.id);

				host.send(message);

			});

		} else {

			//console.log("No active hosts to send announce");

		}

		if(this.bootChannels.size > 0) {

			//console.log("Announcing to " + this.bootChannels.size + " boot channels");

			this.bootChannels.forEach(async (channel) => {

				var message = new Message('announce', {
					id: this.id,
					state: this.stateHash
				});

				await this.signMessage(message);
				channel.send(message);
			});

		} else {
			//console.log("No bootChannels to send announce");
		}
	}

};
