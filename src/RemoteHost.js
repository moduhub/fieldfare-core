/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Message = require('./Message.js');
const Utils = require('./basic/Utils.js');

import { logger } from './basic/Log'

module.exports = class RemoteHost {

	constructor(id) {
		this.id = id;
		this.channels = new Set();
		this.services = new Map();
	}

	send(message) {

		if(this.id == undefined) {
			throw Error('undefined remote host address');
		}

		if(this.channels.size == 0) {
			throw Error('no assigned channels');
		}

		message.setDestinationAddress(this.id);

		for(const channel of this.channels) {

			// logger.log('info', "Dispatching message to "
			// 	+ channel.type
			// 	+ ' channel ('
			// 	+ '-'//JSON.stringify(channel.info)
			// 	+ ')');

			channel.send(message);
		}

	}

	assignChannel(channel) {

		this.channels.add(channel);

		channel.onMessageReceived = (message) => {

			this.treatMessage(message, channel);

		};

		logger.log('info', "Assigning channel to " + this.id
			+ ". Now there are " + this.channels.size
			+ " channels assigned to this remote host.");

	}

	async treatMessage(message, channel) {

		try {
//		logger.log('info', "Message redirected to "
//			+ this.id + ": "
//			+ JSON.stringify(message));

			if(message.service == 'announce') {

				await this.treatAnnounce(message, channel);

			} else
			if(message.service == 'resource') {

				//logger.log('info', "treating resource message (request/response)");
				await this.treatResourceMessage(message, channel);

			} else {

				const localService = host.getLocalService(message.service);

				if(localService === undefined
				|| localService === null) {
					throw Error('unexpected service id');
				}

				if(await this.verifyMessage(message) !== true) {
					throw Error('invalid message signature');
				}

				localService.treatRequest(remoteHost, message.data);

			}

		} catch(error) {
			logger.log('info', "Message parse failed: " + error);
			logger.error('info', "Message parse failed: " + error.stack);
		}
	}

	async treatAnnounce(message, channel) {

		logger.log('info', "Received announce message: " + JSON.stringify(message, null, 2));

		if('id' in message.data === false) {
			throw Error('malformed announce, missing host id');
		}

		if(this.pubKey === undefined) {

			//Get host pubkey
			var remotePubKeyData = await host.getResourceObject(message.data.id, message.data.id);

			logger.log('info', "Remote host pubkey: " + JSON.stringify(remotePubKeyData));

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
			throw Error('invalid message signature');
		}

		//Get host state
		if('state' in message.data === false) {

			logger.log('info', "Announce from "
				+ this.id
				+ " rejected due to invalid signature.");

			throw Error('malformed announce packet, missing state data');
		}

		if(this.state !== message.data.state) {

			this.state = message.data.state;

			if(this.onStateUpdate) {
				this.onStateUpdate(message.data.state);
			}

		}

		if('env' in message.data) {

			for(const uuid in message.data.env) {

				if(Utils.isUUID(uuid) === false) {
					throw Error('Invalid env uuid inside announce');
				}

				const version = message.data.env[uuid];

				if(Utils.isBase64(version) === false) {
					throw Error('Invalid env version inside announce');
				}

				if(this.onEnvironmentUpdate) {
					this.onEnvironmentUpdate(uuid, version);
				}
			}
		}

	}

	async treatResourceMessage(message, channel) {

		if('hash' in message.data == false) {
			throw Error('malformed resouce message');
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
			throw Error('signature verify failed: pubkey undefined');
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

			logger.log('info', "Signature verify result: " + result);

		} else {
			logger.log('info', 'missing signature inside message: ' + JSON.stringify(message));
		}

		return result;
	}

	async accessService(uuid) {

		throw Error('RemoteHost.accessService method still in development');

	}

};
