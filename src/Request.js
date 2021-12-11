/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Message = require('./Message.js');

module.exports = class Request extends Message {
	
	constructor(service, timeout, data) {
		
		super(service, data);
		
		this.listeners = new Set();
		
		this.state = 'pending';
		
		this.timeout = setTimeout(() => {
			console.log('request timeout');
			this.complete(null, 'timeout');
		}, timeout);
		
	}
	
	addListener(callback) {
	
		if(this.state == 'done') {
			
			callback(this.response, this.error);
			
		} else {
			
			//pending
			this.listeners.add(callback);
			
		}
		
	}
	
	complete(response, error) {
		
		if(this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		
		this.state = 'done';
		this.response = response;
		this.error = error;
		
		this.listeners.forEach((callback) => {
			callback(response, error);
		});
		
	}
};
