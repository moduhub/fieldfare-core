// 2023 Adan Kvitschal <adan@moduhub.com>

import {logger} from '../basic/Log';

export class VersionStatement {

	constructor() {
		this.signature = '';
		this.source = '';
		this.data = {
			prev: ''
		};
	}

	/**
	 * used by chunk expansion to validate the raw object fields before
	 * casting into a VersionStatement instance
	 * @param {*} message message of which parameters will be validated
	 */
	static validateParameters(message) {
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
		|| 'elements' in message.data === false
		|| 'changes' in message.data === false) {
			throw Error('malformed update message data');
		}
	}

	/**
	 * Create a root verison statement, only used when a new environment is created
	 * @param {*} uuid version 4 uuid used to uniquely identify the environment
	 * @returns a VersionStatement instance corresponding to the root data
	 */
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
