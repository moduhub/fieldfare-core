// 2023 Adan Kvitschal <adan@moduhub.com>

import { Chunk } from '../chunking/Chunk';
import {logger} from '../basic/Log';

export class VersionStatement {

	constructor() {
		this.signature = '';
		this.source = '';
		this.data = {
			prev: ''
		};
	}

	static async fromDescriptor(descriptor) {
		if(!descriptor) {
			throw Error('descriptor is null');
		}
		if(descriptor instanceof Chunk) {
			descriptor = await descriptor.expand(1);
		}
		if('signature' in descriptor === false
		|| 'source' in descriptor === false
		|| 'data' in descriptor === false) {
			logger.log('info', "Update descriptor validate failed: " + JSON.stringify(descriptor));
			throw Error('malformed update descriptor');
		}
		if('prev' in descriptor.data === false
		|| 'elements' in descriptor.data === false
		|| 'changes' in descriptor.data === false) {
			throw Error('malformed update descriptor data');
		}
		const newStatement = new VersionStatement;
		Object.assign(newStatement, descriptor);
		return newStatement;
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
