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
		
		this.bootChannels = [];
		this.resourcesManagers = [];
		this.remoteHosts = [];
		this.envAdmins = [];
		
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
		
			pubKeyData = JSON.stringify({
				kty: "EC",
				use: "sig",
				crv: "P-256",
				kid: privateKeyData.kid,
				x: privateKeyData.x,
				y: privateKeyData.y,
				alg: "ES256"
			});
						
		} else {
			
			const keypair = crypto.generateKeyPairSync('ec', {
				namedCurve: 'secp256k1'
			});
			
			this.privateKey = keypair.privateKey;
			let pubkey = keypair.publicKey.export({type:'spki',format:'der'});
		}
		
		console.log('host pubkey: ' + pubKeyData);
		
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
		
		//Store state as resource
		var binaryobject = new TextEncoder().encode(JSON.stringify(state));
		
		var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', binaryobject));
		
		this.stateHash = btoa(String.fromCharCode.apply(null, hash));
		
	}
		
	initEnvironment(env) {
		
		console.log("Init environment:" + JSON.stringify(env));
		
		//Get relevant remote hosts from env root
		env.admins.forEach((hostid) => {
			
			if(hostid != this.id) {
				
				this.envAdmins.push(new RemoteHost(hostid));
				
			} else {
				
				console.log("heh, found meeself");
				
			}
			
		});
		
		//Update env from remote hosts data
	}
	
	addResourcesManager(manager) {
		
		this.resourcesManagers.push(manager);
		
	}
	
	bootChannel(channel) {
		
		this.bootChannels.push(channel);
		
		var message = new Message('announce', {
			id: this.id,
			state: this.stateHash
		});
		
		//no source nor destination address, direct message
		channel.send(message);
		
	}
	
	announce() {
		
		console.log("Announce to env admins");
		if(this.envAdmins.length > 0) {
		
			this.envAdmins.forEach(host => {
			
				var message = new Message('announce', {
					id: this.id,
					state: this.stateHash
				});

				message.setSourceAddress(this.id);

				host.send(message);

			});
			
		} else {
			
			console.log("No announces sent: envAdmins is empty");
			
		}
		
		console.log("Announce to boot channels");
		if(this.bootChannels.length > 0) {
			
			this.bootChannels.forEach(channel => {
			
				var message = new Message('announce', {
					id: this.id,
					state: this.stateHash
				});

				channel.send(message);
			});
		}
	}
	
};

