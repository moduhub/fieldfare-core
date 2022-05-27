/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Utils = require('./basic/Utils.js');

import {logger} from './basic/Log'

const SERVICE_ID_ANNOUNCE = 1;
const SERVICE_ID_RESOURCE = 2;


const sServiceIdMap = new Map();

sServiceIdMap.set('announce', SERVICE_ID_ANNOUNCE);
sServiceIdMap.set('resource', SERVICE_ID_RESOURCE);

const SERVICE_FIELD_ID_ANNOUNCE_ID = 1;
const SERVICE_FIELD_ID_ANNOUNCE_STATE = 2;
const SERVICE_FIELD_ID_ANNOUNCE_ENV = 3;

export class Message {

	constructor(service, data) {

		this.service = service;
		this.data = data;

	}

	setDestinationAddress(address) {

		this.destination = address;

	}

	setSourceAddress(address) {

		this.source = address;

	}

	jsonReplacer(key, value) {

		//Add propertires to be ignored or transformed
		// when stringifying the message for tansmission here

		return value;
	}

	toBuffer() {

		//Perform sanity checks
		var serviceId = sServiceIdMap.get(this.service);

		if(serviceId == 'undefined') {
			throw Error('undefined service');
		}

		var direct = false;

		if(this.destination == 'undefined') {
			//Direct message
			direct = true;
		} else {
			//Indirect message withou source
			if(this.source == 'undefined') {
				throw Error('undefined source address');
			}
		}

		//Start conversion
		var buffer = new Uint8Array(98);

		buffer[0] = 0xC0 | direct; //flags
		buffer[1] = serviceId;

		var offset = 2;

		if(direct == 0) {

			var destBuffer = Utils.base64ToArrayBuffer(this.destination);
			var sourceBuffer = Utils.base64ToArrayBuffer(this.source);

			//Source and destination addresses
			buffer.set(new Uint8Array(destBuffer), offset);
			buffer.set(new Uint8Array(sourceBuffer), offset+32);

			offset += 64;

		}
		//Message contents, use specific service parser
		switch(serviceId) {
			case SERVICE_ID_ANNOUNCE: {

				if(this.data.state) {

					var stateBuffer = Utils.base64ToArrayBuffer(this.data.state);

					buffer.set(new Uint8Array(stateBuffer), offset);
					offset += 32;

				}

				if(this.data.env) {

					var envBuffer = Utils.base64ToArrayBuffer(this.data.env);

					buffer.set(new Uint8Array(envBuffer), offset);
					offset += 32;

				}

			} break;

			case SERVICE_ID_RESOURCE: {

				if(this.data.hash) {

					hashBuffer = Utils.base64ToArrayBuffer(this.data.hash);

					buffer.set(hashBuffer, offset);
					offset += 32;

				} else {
					throw Error('resource data.hash missing');
				}

			} break;

			default: {
				throw Error('invalid service id');
			} break;
		}

		return buffer;
	}

	fromBuffer(buffer) {

		var serviceID = buffer.readInt8();

		var destAddress = buffer.slice(1,32);
		var sourceAddress = buffer.slice(32,64);

		logger.log('info', "Destination: " + destAddress.toString('hex'));
		logger.log('info', "Source: " + sourceAddress.toString('hex'));

		if(serviceID == SERVICE_ID_ANNOUNCE) {

			//resource copy or provide
			logger.log('info', "Service: Announce");

			var hostID = buffer.slice(1,32);
			var envID = buffer.slice(33,64);
			//var signature = message.slice(64,96);

			logger.log('info', "Host ID: " + hostID.toString('hex'));
			logger.log('info', "Env ID: " + envID.toString('hex'));
			//logger.log('info', "Signature: " + signature.toString('hex'));

			//ask for pubkey resource
			//resources.getResource(hostID)
			//.then({
				//validate signature
				//ask for env resource
			//});


		} else
		if(serviceID == SERVICE_ID_RESOURCE_REQUEST) {

			//resource copy or provide
			logger.log('info', "Service: Resource Request");

			var hash = buffer.slice(64,96);

			logger.log('info', "Hash: " + hash.toString('hex'));

		} else {

			logger.log('info', "Service: Invalid");

		}
	}

};
