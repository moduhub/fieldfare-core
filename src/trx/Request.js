/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Message } from './Message.js';
import { logger } from '../basic/Log.js';

export class Request extends Message {

	constructor(service, data, timeout=10000) {
		super(service, data);
		this.resolveCallbacks = new Set();
		this.rejectCallbacks = new Set();
		this.ts = Date.now();
		this.timeout = setTimeout(() => {
			logger.debug('request timeout');
			const error = Error('Request ' + JSON.stringify(this.data.id) + ' timed out');
			error.name = 'TIMEOUT_ERROR';
			this.reject(error);
		}, timeout);
	}

	get age() {
		return Date.now() - this.ts;
	}

	jsonReplacer(key, value) {
		//Add propertires to be ignored or transformed
		// when stringifying the message for tansmission here
		if(key === 'resolveCallbacks') return undefined;
		if(key === 'rejectCallbacks') return undefined;
		if(key === 'error') return undefined;
		if(key === 'response') return undefined;
		if(key === 'timeout') return undefined;
		return super.jsonReplacer(key, value);
	}

	reject(error) {
		this.resolveCallbacks.clear();
		if(this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		this.error = error;
		for (const callback of this.rejectCallbacks) {
			callback(error);
		}
		this.rejectCallbacks.clear();
	}

	resolve(response) {
		this.rejectCallbacks.clear();
		if(this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		this.response = response;
		for (const callback of this.resolveCallbacks) {
			callback(response);
		}
		this.resolveCallbacks.clear();
	}

	isComplete() {
		return this.response || this.error;
	}

	complete() {
		if(this.error) throw this.error;
		if(this.response) return this.result;
		return new Promise((resolve, reject) => {
			this.resolveCallbacks.add( (result) => resolve(result) );
			this.rejectCallbacks.add( (error) => reject(error) );
		});
	}

};
