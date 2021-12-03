/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const { Buffer } = require('buffer');
const crypto = require('crypto')
//const openssl = require('openssl-nodejs');

const SERVICE_ID_ANNOUNCE = 1;
const SERVICE_ID_RESOURCE_REQUEST = 2;
const SERVICE_ID_RESOURCE_RESPONSE = 3;

module.exports = class HostManager {

	constructor(privateKey) {

		let pubkey;

		if(privateKey) {
		
			this.privateKey = crypto.createPrivateKey({
				key:privateKey,
				type:'sec1',
				format:'der'});
			
			pubkey = crypto.createPublicKey({
				key:privateKey,
				type:'sec1',
				format:'der'}).export({type:'spki',format:'der'});
			
		} else {
			
			const keypair = crypto.generateKeyPairSync('ec', {
				namedCurve: 'secp256k1'
			});
			
			this.privateKey = keypair.privateKey;
			pubkey = keypair.publicKey.export({type:'spki',format:'der'});
		}
		
		console.log('host pubkey: ' + pubkey.toString('hex'));
		
		//Calculate host ID from pubkey
		let hash = crypto.createHash('sha256');
		
		hash.update(pubkey);
		
		this.id = hash.digest();
	
		console.log('host id: ' + this.id.toString('hex'));
	
		this.envid = Buffer.from('44fefd3ec59498bff8fdf19750251e70ad2789f0acdcbcbc747de3b6b985c644', 'hex');
		
		this.channels = [];
	}
	
	addChannel(channel) {
		
		this.channels.push(channel);
		
	}
	
	announce() {
		
		var message = Buffer.alloc(128);
		
		message.writeUInt8(SERVICE_ID_ANNOUNCE);
		
		this.id.copy(message, 1);
		this.envid.copy(message, 33);
		
		//Announce contents
		
		this.dispatch(message);
	}
	
	parse(message) {
	
		var serviceID = message.readInt8();
	
		var destAddress = message.slice(1,32);
		var sourceAddress = message.slice(32,64);
	
		console.log("Destination: " + destAddress.toString('hex'));
		console.log("Source: " + sourceAddress.toString('hex'));
	
		if(serviceID == SERVICE_ID_ANNOUNCE) {

			//resource copy or provide
			console.log("Service: Announce");
			
			var hostID = message.slice(1,32);
			var envID = message.slice(33,64);
			//var signature = message.slice(64,96);
				
			console.log("Host ID: " + hostID.toString('hex'));
			console.log("Env ID: " + envID.toString('hex'));
			//console.log("Signature: " + signature.toString('hex'));
			
			//ask for pubkey resource
			resources.getResource(hostID)
			.then({
				//validate signature
				//ask for env resource
			});
			

		} else
		if(serviceID == SERVICE_ID_RESOURCE_REQUEST) {
		
			//resource copy or provide
			console.log("Service: Resource Request");
			
			var hash = message.slice(64,96);
		
			console.log("Hash: " + hash.toString('hex'));
		
		} else {
		
			console.log("Service: Invalid");
		
		}
	}
	
	dispatch(message) {
		
		//send to all neighbors
		this.channels.forEach((channel) => {
			
			console.log("Dispatching message to "
				+ channel.info.address
				+ ':'
				+ channel.info.port);
			
			channel.send(message);
		});
		
	}
};

