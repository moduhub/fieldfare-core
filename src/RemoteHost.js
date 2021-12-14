/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Message = require('./Message.js');


module.exports = class RemoteHost {

	constructor(id) {
		this.id = id;
		this.channels = new Set();
	}
	
	send(message) {
		
		if(this.id == undefined) {
			throw 'undefined remote host address';
		}
		
		message.setDestinationAddress(this.id);
		
		if(this.channels.size > 0) {
			
			this.channels.forEach((channel) => {

//				console.log("Dispatching message to "
//					+ channel.type
//					+ ' channel ('
//					+ '-'//JSON.stringify(channel.info)
//					+ ')');

				channel.send(message);
				
			});
			
		} else {
			console.log("Remote host send message failed: no assigned channels");
		}
		
	}
	
	assignChannel(channel) {

		this.channels.add(channel);
		
		channel.onMessageReceived = (message) => {
		
			this.treatMessage(message, channel);
			
		};
		
		console.log("Assigning channel to " + this.id
			+ ". Now there are " + this.channels.size
			+ " channels assigned to this remote host.");
		
	}
	
	treatMessage(message, channel) {
		
//		console.log("Message redirected to "
//			+ this.id + ": "
//			+ JSON.stringify(message));
		
		if(message.service == 'announce') {
			
			this.treatAnnounce(message, channel)
			
		} else
		if(message.service == 'resource') {
			
			//console.log("treating resource message (request/response)");
			this.treatResourceMessage(message, channel);
			
		} else {
		
			throw 'unexpectd service id';
		
		}
	}
	
	treatAnnounce(message, channel) {
		
		if('state' in message.data) {
				
			if(this.state !== message.data.state) {

				this.state = message.data.state;

				if(this.onStateUpdate) {
					this.onStateUpdate(message.data.state);
				}

			}

		} else {
			throw 'malformed announce packet, missing state data';
		}
		
	}
	
	async treatResourceMessage(message, channel) {
	
		if('hash' in message.data == false) {
			throw 'malformed resouce message';
		}

		if('data' in message.data) {
			
			//this is a response to a previous request
			if(this.onResponseReceived) {
			
				this.onResponseReceived(message, channel);
				
			} else {
				throw 'treatResourceMessage: undefined response callback'
			}
			
		} else {
			
			//this is a request for a resource that i have
			if(this.requestLocalResource) {

				var data = await this.requestLocalResource(message.data.hash);

				var response;

				if(data == undefined) {
					
					//not found, generate error response
					response = new Message('resource', {
						hash: message.data.hash,
						error: 'not found'
					});
					
				} else {

					//generate positive response
					response = new Message('resource', {
						hash: message.data.hash,
						data: data
					});

				}
				
				this.send(response);

			} else {
				throw 'treatResourceMessage: undefined callback';
			}
		}
	}
};
