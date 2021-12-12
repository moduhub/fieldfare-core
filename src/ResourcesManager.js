/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

//const { subtle } = require('crypto').webcrypto;
//const crypto = require('crypto');

module.exports = class ResourcesManager {
	
	constructor() {
	
		this.hashmap = new Map;
		
		setInterval(() => {
			console.log("Memory Resources Manager: " + this.hashmap.size + " resources stored.");
		}, 30000);
	}
	
	async storeResource(data) {
		
		var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
			
		var base64data = btoa(String.fromCharCode.apply(null, data));
		var base64hash = btoa(String.fromCharCode.apply(null, hash));

		this.hashmap.set(base64hash, base64data);
		
		/*
		console.log("res.store("
			+ base64hash
			+ ", "
			+ base64data
			+ ") >hashmap size: " + this.hashmap.size);
		*/
		return base64hash;
	}
	
	getResource(hash) {
		
		var base64data = this.hashmap.get(hash);

		return base64data;
	}
	
};
