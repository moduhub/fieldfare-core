/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

//const { subtle } = require('crypto').webcrypto;
//const crypto = require('crypto');

const Utils = require('./Utils.js');
	

module.exports = class ResourcesManager {
	
	constructor() {
	
		this.hashmap = new Map;
		
		setInterval(() => {
			console.log("Memory Resources Manager: " + this.hashmap.size + " resources stored.");
		}, 30000);
	}
	
	async storeResource(base64data) {

		var dataBuffer = Utils.base64ToArrayBuffer(base64data);
		
		var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', dataBuffer));

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
	
	getResource(base64hash) {
		
		var base64data = this.hashmap.get(base64hash);

		return base64data;
	}
	
};
