/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Message = require('./Message.js');
const Utils = require('./basic/Utils.js');


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

		if('id' in message.data === false) {
			throw 'malformed announce, missing host id';
		}

		if(this.pubKey === undefined) {

			//Get host pubkey
			var remotePubKeyData = await host.getResourceObject(message.data.id, message.data.id);

			console.log("Remote host pubkey: " + JSON.stringify(remotePubKeyData));

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
			throw 'invalid message signature';
		}

		//Get host state
		if('state' in message.data === false) {

			console.log("Announce from "
				+ this.id
				+ " rejected due to invalid signature.");

			throw 'malformed announce packet, missing state data';
		}

		if(this.state !== message.data.state) {

			this.state = message.data.state;

			if(this.onStateUpdate) {
				this.onStateUpdate(message.data.state);
			}

		}

		if('env' in message.data) {
			if(this.envVersion !== message.data.env) {
				this.envVersion = message.data.env;
				if(this.onEnvironmentUpdate) {
					this.onEnvironmentUpdate(message.data.env);
				}
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

	async accessService(uuid) {

		throw 'RemoteHost.accessService method still in development';

	}

};
