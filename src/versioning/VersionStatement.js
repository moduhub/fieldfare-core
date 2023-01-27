/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {ResourcesManager} from '../chunking/ChunkManager';
import {logger} from '../basic/Log';

export class VersionStatement {

	constructor() {
		this.signature = '';
		this.source = '';
		this.data = {
			prev: ''
		};
	}

	static validate(message) {

		if(!message) {
			throw Error('message is null');
		}

		if('signature' in message === false
		|| 'source' in message === false
		|| 'data' in message === false) {

			logger.log('info', "Update message validate failed: " + JSON.stringify(message));

			throw Error('malformed update message');
		}

		if('prev' in message.data === false
		|| 'state' in message.data === false
		|| 'changes' in message.data === false) {
			throw Error('malformed update message data');
		}

	}

	static async fromResource(hash, source) {

		const resourceObject = await ResourcesManager.getResourceObject(hash, source);

		VersionStatement.validate(resourceObject);

		var newMessage = new VersionStatement();

		Object.assign(newMessage, resourceObject);

		return newMessage;
	}

	static async createRoot(uuid) {

		var rootStatement = new VersionStatement();

		rootStatement.data = {
			prev: '',
			state: '',
			changes: await ResourcesManager.storeResourceObject({uuid:uuid})
		};

		return rootStatement;
	}

};
