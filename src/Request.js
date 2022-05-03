/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Message = require('./Message.js');

module.exports = class Request extends Message {

	constructor(service, timeout, data) {

		super(service, data);

		this.resolveCallbacks = new Set();
		this.rejectCallbacks = new Set();

		this.timeout = setTimeout(() => {
			console.log('request timeout');
			const error = Error('Request ' + JSON.stringify(this.data) + ' timed out');
			error.name = 'TIMEOUT_ERROR';
			this.reject(error);
		}, timeout);

	}

	jsonReplacer(key, value) {

		//Add propertires to be ignored or transformed
		// when stringifying the message for tansmission here
		if(key === 'listeners') return undefined;
		if(key === 'state') return undefined;
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

		if(this.error) return this.error;
		if(this.response) return this.result;

		return new Promise((resolve, reject) => {

			this.resolveCallbacks.add( (result) => resolve(result) );
			this.rejectCallbacks.add( (error) => reject(error) );

		})
	}

};
