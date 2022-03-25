/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

module.exports = class VersionStatement {

	constructor() {
		
	}
	
	static validate(message) {
		
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
	
	static async fromResource(hash, source) {
		
		const resourceObject = await host.getResourceObject(hash, source);
		
		VersionStatement.validate(newMessage);

		var newMessage = new VersionStatement();
		
		Object.assign(newMessage, resourceObject);
				
		return newMessage;
	}
	
	async buildChain(messageHash, maxDepth) {
		
		var iUpdateMessage = this;
		var depth = 0;
		var chain = new Array();
		
		do {

			await VersionStatement.validate(iUpdateMessage);

			const prevHash = iUpdateMessage.data.prev;
			const currentSource = iUpdateMessage.source;

			if(prevHash === '') {
				//Found chain origin without any match
				throw 'version msg not in chain';
			}

			try {

				//Attemp to get last update from same source
				iUpdateMessage = await VersionStatement.fromResource(prevHash, currentSource);
				
			} catch(error) {

				//If could not access same source, attmp all other admins
				for(let [adminID, admin] of this.admins) {

					try {
						//Attemp all other set admins if owner is not available
						iUpdateMessage = await VersionStatement.fromResource(prevHash, adminID);

						break;

					} catch(error) {
						//Data not available in this admin, try next
					}

				}

			}

			if(iUpdateMessage == null
			|| iUpdateMessage == undefined) {
			
				//Searched all hosts with no success
				throw 'Failed to fetch a update message inside chain';
				
			}

			chain.push(iUpdateMessage);
			
			if(++depth>maxDepth) {
				throw 'build chain failed: max depth reached';
			}

		} while(iUpdateMessage.data.prev !== this.currentVersion);
		
		return chain;
	}
	
};
	

