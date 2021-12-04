/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const { Buffer } = require('buffer');
const crypto = require('crypto')
//const openssl = require('openssl-nodejs');


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
		this.resourcesManagers = [];
	}
	
	addResourcesManager(manager) {
		
		this.resourcesManagers.push(manager);
		
	}
	
	addChannel(channel) {
		
		this.channels.push(channel);
		
	}
	
	announce() {
		
		var message = new Message(this.envid, 'announce', {
			id: this.id
		});
				
		this.dispatch(message);
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

