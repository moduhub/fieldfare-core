/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const SERVICE_ID_ANNOUNCE = 1;
const SERVICE_ID_RESOURCE_REQUEST = 2;
const SERVICE_ID_RESOURCE_RESPONSE = 3;

module.exports = class Message {
	
	constructor(destination, service, data) {
		
		this.destination = destination;
		this.service = service;
		this.data = data;
		
	}
	
	toBuffer() {
		
		var buffer = new Uint8Array(128);
		
		buffer.writeUInt8(SERVICE_ID_ANNOUNCE);
		
		return buffer;
	}
	
	fromBuffer(buffer) {
	
		var serviceID = buffer.readInt8();
	
		var destAddress = buffer.slice(1,32);
		var sourceAddress = buffer.slice(32,64);
	
		console.log("Destination: " + destAddress.toString('hex'));
		console.log("Source: " + sourceAddress.toString('hex'));
	
		if(serviceID == SERVICE_ID_ANNOUNCE) {

			//resource copy or provide
			console.log("Service: Announce");
			
			var hostID = buffer.slice(1,32);
			var envID = buffer.slice(33,64);
			//var signature = message.slice(64,96);
				
			console.log("Host ID: " + hostID.toString('hex'));
			console.log("Env ID: " + envID.toString('hex'));
			//console.log("Signature: " + signature.toString('hex'));
			
			//ask for pubkey resource
			//resources.getResource(hostID)
			//.then({
				//validate signature
				//ask for env resource
			//});
			

		} else
		if(serviceID == SERVICE_ID_RESOURCE_REQUEST) {
		
			//resource copy or provide
			console.log("Service: Resource Request");
			
			var hash = buffer.slice(64,96);
		
			console.log("Hash: " + hash.toString('hex'));
		
		} else {
		
			console.log("Service: Invalid");
		
		}
	}
	
};
