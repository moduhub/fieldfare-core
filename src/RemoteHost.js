/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


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

				console.log("Dispatching message to "
					+ channel.type
					+ ' channel ('
					+ JSON.stringify(channel.info)
					+ ')');

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
			+ " channels assigne to this remote host.");
		
	}
	
	treatMessage(message, channel) {
		
		console.log("Message redirected to "
			+ this.id + ": "
			+ JSON.stringify(message));
		
		if(message.service == 'announce') {
			
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
	}
	
};
