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
	
	validateUpdateMessage(message) {
		
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
			
				if(iUpdateMessage.prev === '') {
					//Found chain origin without any match
					throw 'version msg not in chain';
				}
				
				var iUpdateMessage = null;
				
				try {
					
					iUpdateMessage = await host.getResource(iUpdateMessage.data.prev,
										iUpdateMessage.source);
				} catch(error) {
					
					for(let [adminID, admin] of this.admins) {
						
						try {
							//Attemp all other set admins if owner is not available
							iUpdateMessage = await host.getResource(iUpdateMessage.data.prev,
												adminID);
							
							break;
							
						} catch(error) {
							//Data not available in this admin, try next
						}
						
					}

				}
				
				//Searched all hosts with no success
				if(iUpdateMessage == null
				|| iUpdateMessage == undefined) {
					throw 'Failed to fetch a update message inside chain';
				}
				
				await this.validateUpdateMessage(iUpdateMessage);
			}
			
			//If this point was reached, state chain is valid and is a continuation
			// of the current local version.
			this.currentVersion = message.data.version;
			
		} catch (error) {
			
			console.log("Versioned Set update error: " + error);
			
		}
		
	}
	
};