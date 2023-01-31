/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {Message} from './Message';
import {logger} from '../basic/Log';


export class Request extends Message {

	constructor(service, timeout, data) {
		super(service, data);
		this.resolveCallbacks = new Set();
		this.rejectCallbacks = new Set();
		this.timeout = setTimeout(() => {
			logger.debug('request timeout');
			const error = Error('Request ' + JSON.stringify(this.data) + ' timed out');
			error.name = 'TIMEOUT_ERROR';
			this.reject(error);
		}, timeout);
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

	complete() {
		if(this.error) throw this.error;
		if(this.response) return this.result;
		return new Promise((resolve, reject) => {
			this.resolveCallbacks.add( (result) => resolve(result) );
			this.rejectCallbacks.add( (error) => reject(error) );
		})
	}

};
