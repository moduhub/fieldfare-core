/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

//const { Buffer } = require('buffer');

const Message = require('./Message.js');
const Utils = require('./Utils.js');
const RemoteHost = require('./RemoteHost.js');


module.exports = class HostManager {

	constructor() {
		
		this.bootChannels = new Set();
		this.resourcesManagers = new Set();
		this.remoteHosts = new Map();
		this.envAdmins = new Set();
		
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
		
		if(this.resourcesManagers.size > 0) {
			
			//Store state as resource, use just the first resources manager
			var iterator = this.resourcesManagers.values();
			var res = iterator.next().value;
				
			this.stateHash = await res.storeObject(state);
			
			console.log("State hash: " + this.stateHash);
		} else {
			throw 'cannot update state without a resoures manager';
		}		

//		var binaryobject = new TextEncoder().encode(JSON.stringify(state));
//		
//		var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', binaryobject));
//		
//		this.stateHash = btoa(String.fromCharCode.apply(null, hash));
		
	}
		
	initEnvironment(env) {
		
		console.log("Init environment:" + JSON.stringify(env));
		
		//Get relevant remote hosts from env root
		env.admins.forEach((hostid) => {
			
			if(hostid != this.id) {
				
				var newHost = new RemoteHost(hostid);
				
				this.envAdmins.add(newHost);
				this.remoteHosts.set(hostid, newHost);
				
			} else {
				
				console.log("heh, found meeself in admin list");
				
			}
			
		});
		
		//Update env from remote hosts data
	}
	
	addResourcesManager(manager) {
		
		this.resourcesManagers.add(manager);
		
		manager.onNewRequest = (request) => {
		
			console.log("Forwarding request to request.destination")
		
			var destinationHost = this.remoteHosts.get(request.destination);
			
			if(destinationHost != undefined) {

				request.source = this.id;
				
				destinationHost.send(request);
				
			} else {
				console.log("Destination is unknown");
			}
			
		};
		
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
						
						remoteHost = new RemoteHost(remoteId);
						
						this.remoteHosts.set(remoteId, remoteHost);
						
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

