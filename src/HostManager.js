/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

//const { Buffer } = require('buffer');

const Message = require('./Message.js');
const Utils = require('./Utils.js');
const RemoteHost = require('./RemoteHost.js');
const Request = require('./Request.js');


module.exports = class HostManager {

	constructor() {
		
		this.bootChannels = new Set();
		this.resourcesManagers = new Set();
		this.remoteHosts = new Map();
		this.envAdmins = new Set();
		this.requests = new Map();
		
	}
	
	async setupId(privateKeyData) {

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
		
			pubKeyData = Utils.str2ab(JSON.stringify({
				kty: "EC",
				use: "sig",
				crv: "P-256",
				kid: privateKeyData.kid,
				x: privateKeyData.x,
				y: privateKeyData.y,
				alg: "ES256"
			}));
						
		} else {
			
			const keypair = crypto.generateKeyPairSync('ec', {
				namedCurve: 'secp256k1'
			});
			
			this.privateKey = keypair.privateKey;
			let pubkey = keypair.publicKey.export({type:'spki',format:'der'});
		}
		
		console.log('host pubkey data: ' + Utils.arrayBufferToBase64(pubKeyData));
		
		//Calculate host ID from pubkey
		var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', pubKeyData));
		
		this.id = Utils.arrayBufferToBase64(hash);
	
		console.log('host id: ' + this.id);
		
		setInterval(() => {
			console.log("Host is announcing");
			this.announce();
		}, 10000);
		
	}
	
	async updateState(state) {
		
		console.log("Current state:" + JSON.stringify(state));
		
		this.stateHash = await this.storeResourceObject(state);
			
		console.log("State hash: " + this.stateHash);
		
	}
		
	initEnvironment(env) {
		
		console.log("Init environment:" + JSON.stringify(env));
		
		//Get relevant remote hosts from env root
		env.admins.forEach((hostid) => {
			
			if(hostid != this.id) {
				
				var newHost = this.registerRemoteHost(hostid);
				
				this.envAdmins.add(newHost);
				
			} else {
				
				console.log("heh, found meeself in admin list");
				
			}
			
		});
		
		//Update env from remote hosts data
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
		
		var binaryobject = new TextEncoder().encode(JSON.stringify(object));
		
		var hash = await this.storeResource(binaryobject);
		
		return hash;
	}
	
	async getResourceObject(hash, owner) {
		
		var object;
		
		try {
		
			var base64data = await this.getResource(hash, owner);
		
			object = JSON.parse(atob(base64data));

		} catch(error) {
			
			console.log("host.getResource error: " + error);
			
		}
		
		return object;
	}
	
	async storeResource(data) {
		
		var base64hash;
		
		if(this.resourcesManagers.size > 0) {
			
			//Temp: storing all on first manager
			var result = this.resourcesManagers.values().next();
			if(!result.done) {

				var manager = result.value;

				base64hash = await manager.storeResource(data);
			
			}

		} else {
			throw 'No resources managers defined';
		}		

		return base64hash;		
	}
	
	getResource(hash, owner) {
		
		return new Promise((resolve, reject) => {
			
			//Attemp to find rsource on all resources managers
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
		
				console.log("res.fetch: Not found locally. Owner: " + owner);
				
				//not found locally, attemp to find on remote host
				
				if(owner
				&& owner !== null
				&& owner !== undefined) {
				
					//Check if there is already a request for
					//this same hash
					
					console.log("res.fetch: looking for previous request");
					
					var request = this.requests.get(hash);
				
					console.log("res.fetch: previous request = " + request);
				
					if(request == undefined) {
						
						console.log("res.fetch: new request");
						
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
							
							//console.log ("Received remote resource response:" + JSON.stringify(response.data.data));
							
							resolve(response.data.data);
						}
						
					});
					
					//Notify that a new request was created
					this.onNewRequest(request);

				} else {
					
					//console.log("get resource: rejected no owner");
					
					//Owner not know, fail
					reject("resource not found");
					
				}
				
			}
		});
		
	}
	
	addResourcesManager(manager) {
		
		this.resourcesManagers.add(manager);
		
	}
	
	onNewRequest(request) {
		
		console.log("Forwarding request to request.destination")

		var destinationHost = this.remoteHosts.get(request.destination);

		if(destinationHost != undefined) {

			request.source = this.id;

			destinationHost.send(request);

		} else {
			
			console.log("Destination is unknown");
			
			//TODO: routing here
		}

	}
	
	bootChannel(channel) {
		
		this.bootChannels.add(channel);
		
		var announceMessage = new Message('announce', {
			id: this.id,
			state: this.stateHash
		});
		
		channel.onMessageReceived = (message) => {
			
			console.log("Received message from boot channel: " + JSON.stringify(message));
			
			if(message.service == 'announce') {
			
//				console.log("message.source: " + message.source);
//				console.log("message.destination: " + message.destination);
			
				if(!message.hasOwnProperty('source')
				&& !message.hasOwnProperty('destination')) {
				
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
					
				} else {
					
					console.log("Message is not direct, reject from boot channel");
				}
				
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
	
	announce() {
		
		if(this.envAdmins.size > 0) {
			
			console.log("Announcing to " + this.envAdmins.size + " env admins");
		
			this.envAdmins.forEach(host => {
			
				var message = new Message('announce', {
					id: this.id,
					state: this.stateHash
				});

				message.setSourceAddress(this.id);

				host.send(message);

			});
			
		} else {
			
			console.log("No envAdmins to send announce");
			
		}
		
		if(this.bootChannels.size > 0) {
		
			console.log("Announcing to " + this.bootChannels.size + " boot channels");
			
			this.bootChannels.forEach(channel => {
			
				var message = new Message('announce', {
					id: this.id,
					state: this.stateHash
				});

				channel.send(message);
			});
			
		} else {
			console.log("No bootChannels to send announce");
		}
	}
	
};

