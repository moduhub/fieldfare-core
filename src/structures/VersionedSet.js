/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


module.exports = class VersionedSet {
	
	contructor(currentVersion) {
		
		this.currentVersion = currentVersion;
		
		this.admins = new Map();
		this.elements = new Set();
		
	}
	
	verifyUpdateMessage(message) {
		
		if('signature' in message === false
		|| 'source' in message === false
		|| 'data' in message === false) {
			throw 'malformed update message';
		} else
		if('prev' in message.data === false
		|| 'version' in message.data === false) {
			throw 'malformed update message data';
		}
		
		var source = this.admins.get(message.source);
		
		if(source == undefined
		|| source == null) {
			throw 'source not in admins list';
		}
		
		if(source.verifyMessage(message) === false) {
			throw 'message sinature invalid';
		}
	}
	
	async update(message) {
		
		try {
			
			await this.validateUpdateMessage(message);
			
			while(iUpdateMessage.data.prev !== this.currentVersion) {
				
				var iUpdateMessage = await host.getResource(	iUpdateMessage.data.prev,
										iUpdateMessage.source);
										
				await this.validateUpdateMessage(iUpdateMessage);
				
				if(iUpdateMessage.prev === '') {
					throw 'version msg not in chain';
				}
			}
			
			//
			
		} catch (error) {
			
			console.log("VersionedSet update error: " + error);
			
		}
		
	}
	
};