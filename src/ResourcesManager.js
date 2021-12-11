/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

//const { subtle } = require('crypto').webcrypto;
//const crypto = require('crypto');

const Request = require('./Request.js');

module.exports = class ResourcesManager {
	
	constructor() {
	
		this.hashmap = new Map;
		this.requests = new Map;
		
	}
	
	async storeObject(object) {
		
		var binaryobject = new TextEncoder().encode(JSON.stringify(object));
		
		var hash = await this.store(binaryobject);
		
		return hash;
	}
	
	async fetchObject(hash, owner) {
		
		var object;
		
		try {
		
			//console.log("Fetch object hash: " + hash);
		
			var base64data = await this.fetch(hash, owner);
		
			//console.log("Fetch object base64: " + base64data);
		
			object = JSON.parse(atob(base64data));

			//console.log("Fetch object: " + JSON.stringify(object));
			
		} catch(error) {
			
			console.log("fetchObject error: " + error);
			
		}
		
		return object;
	}
	
	async store(data) {
		
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
	
	fetch(hash, owner) {
		
		return new Promise((resolve, reject) => {
			
			var base64data = this.hashmap.get(hash);
			
			if(base64data
			&& base64data !== null
			&& base64data !== undefined) {
		
				//console.log("resolved case 1, nase64 data: " + base64data);
				
				resolve(base64data);
				
			} else {
				
				console.log("res.fetch: Not found locally");
				
				//not found locally, attemp to find on owner db
				
				if(owner
				&& owner !== null
				&& owner !== undefined) {
				
					//Check if there is already a request for
					//this same hash
					
					console.log("res.fetch: looking for previous request");
					
					var request = this.requests.get(hash);
				
					console.log("res.fetch: previous request = " + request);
				
					if(request == undefined) {
						
						console.log("res.fetch: new request");
						
						request = new Request('resource', 10000, {
							hash: hash
						});
				
						request.setDestinationAddress(owner);
				
						//send request
						this.requests.set(hash, request);
				
					}
						
					//Listen for request completion
					request.addListener((response, error) => {
						
						if(error
						&& error !== null
						&& error !== undefined) {
						
							//console.log("get resource rejected: timeout");
						
							reject(error);
						} else {
							resolve(response.data);
						}
						
					});
					
					//Notify that a new request was created
					if(this.onNewRequest) {
						this.onNewRequest(request);
					}

				} else {
					
					//console.log("get resource: rejected no owner");
					
					//Owner not know, fail
					reject("not found");
					
				}
				
			}
		});
		
	}
	
};
