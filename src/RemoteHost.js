/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Message = require('./Message.js');
const Utils = require('./Utils.js');


module.exports = class RemoteHost {

	constructor(id) {
		this.id = id;
		this.channels = new Set();
	}
	
	send(message) {
		
		if(this.id == undefined) {
			throw 'undefined remote host address';
		}
		
		message.setDestinationAddress(this.id);
		
		if(this.channels.size > 0) {
			
			this.channels.forEach((channel) => {

//				console.log("Dispatching message to "
//					+ channel.type
//					+ ' channel ('
//					+ '-'//JSON.stringify(channel.info)
//					+ ')');

				channel.send(message);
				
			});
			
		} else {
			console.log("Remote host send message failed: no assigned channels");
		}
		
	}
	
	assignChannel(channel) {

		this.channels.add(channel);
		
		channel.onMessageReceived = (message) => {
		
			this.treatMessage(message, channel);
			
		};
		
		console.log("Assigning channel to " + this.id
			+ ". Now there are " + this.channels.size
			+ " channels assigned to this remote host.");
		
	}
	
	treatMessage(message, channel) {
		
		try {
//		console.log("Message redirected to "
//			+ this.id + ": "
//			+ JSON.stringify(message));
		
			if(message.service == 'announce') {

				this.treatAnnounce(message, channel)

			} else
			if(message.service == 'resource') {

				//console.log("treating resource message (request/response)");
				this.treatResourceMessage(message, channel);

			} else {

				throw 'unexpected service id';

			}
			
		} catch(error) {
			console.log("Message parse failed: " + error);
		}
	}
	
	async treatAnnounce(message, channel) {
		
		if('id' in message.data) {
			
			if(this.pubKey === undefined) {
				
				//Get host pubkey
				var remotePubKeyData = await host.getResourceObject(message.data.id, message.data.id);

				if(remotePubKeyData !== undefined) {
					
					try {
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
					
					} catch (error) {
						console.log("Failed to import remote pub key from resource: " + error);
					}

					console.log("Remote host pubkey: " + JSON.stringify(remotePubKeyData));
					
				} else {
					console.log("failed to get remote host pubkey, not a good signal");
				}

			}
			
		} else {
			throw 'malformed announce, missing host id';
		}
		
		
		//Do not accept state before message is verified
		if(this.pubKey) {
			
			if(await this.verifyMessage(message) == true) {
			
				//Get host state
				if('state' in message.data) {

					if(this.state !== message.data.state) {

						this.state = message.data.state;

						if(this.onStateUpdate) {
							this.onStateUpdate(message.data.state);
						}

					}

				} else {
					throw 'malformed announce packet, missing state data';
				}
				
			} else {
								
				console.log("Announce from "
					+ this.id
					+ " rejected due to invalid signature.");
			}
		}
		
	}
	
	async treatResourceMessage(message, channel) {
	
		if('hash' in message.data == false) {
			throw 'malformed resouce message';
		}

		if('data' in message.data) {
			
			//this is a response to a previous request
			if(this.onResponseReceived) {
			
				this.onResponseReceived(message, channel);
				
			} else {
				throw 'treatResourceMessage: undefined response callback'
			}
			
		} else {
			
			//this is a request for a resource that i have
			if(this.requestLocalResource) {

				var data = await this.requestLocalResource(message.data.hash);

				var response;

				if(data == undefined) {
					
					//not found, generate error response
					response = new Message('resource', {
						hash: message.data.hash,
						error: 'not found'
					});
					
				} else {

					//generate positive response
					response = new Message('resource', {
						hash: message.data.hash,
						data: data
					});

				}
				
				this.send(response);

			} else {
				throw 'treatResourceMessage: undefined callback';
			}
		}
	}
	
	async verifyMessage(message) {
		
		var result = false;
		
		if(this.pubKey === undefined) {
			throw 'signature verify failed: pubkey undefined';
		}
		
		if('signature' in message) {
			
			var signatureBuffer = Utils.base64ToArrayBuffer(message.signature);
			
			var dataBuffer = new TextEncoder().encode(JSON.stringify(message.data));
			
			result = await crypto.subtle.verify(
				{
					name: "ECDSA",
					hash: {name: "SHA-256"}
				},
				this.pubKey,
				signatureBuffer,
				dataBuffer);
				
			console.log("Signature verify result: " + result);
					
		} else {
			console.log('missing signature inside message: ' + JSON.stringify(message));
		}
		
		return result;
	}
	
};
