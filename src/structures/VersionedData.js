/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

class UpdateMessage {

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
		
		UpdateMessage.validate(newMessage);

		var newMessage = new UpdateMessage();
		
		Object.assign(newMessage, resourceObject);
				
		return newMessage;
	}
	
	async buildChain(messageHash, maxDepth) {
		
		var iUpdateMessage = this;
		var depth = 0;
		var chain = new Array();
		
		do {

			await UpdateMessage.validate(iUpdateMessage);

			const prevHash = iUpdateMessage.data.prev;
			const currentSource = iUpdateMessage.source;

			if(prevHash === '') {
				//Found chain origin without any match
				throw 'version msg not in chain';
			}

			try {

				//Attemp to get last update from same source
				iUpdateMessage = await UpdateMessage.fromResource(prevHash, currentSource);
				
			} catch(error) {

				//If could not access same source, attmp all other admins
				for(let [adminID, admin] of this.admins) {

					try {
						//Attemp all other set admins if owner is not available
						iUpdateMessage = await UpdateMessage.fromResource(prevHash, adminID);

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

module.exports = class VersionedData {
	
	constructor() {
		
		this.adminsHLT = '';
		this.latestUpdate = '';
		
		this.admins = new HashLinkedTree(5);
		
		this.version = '';
		
	}

	async update(pMessage) {
		
		await UpdateMessage.validate(pMessage);

		try {
		
			var chain = await pMessage.buildChain(this.version, 50);
			
			//Perform changes sequentially
			for await (const iMessage of chain) {
			
				await UpdateMessage.validate(iMessage);
			
				if(await this.apply(iMessage.data.change, iMessage.data.version) == false) {
					throw 'Update rejected due to invalid chain';
				}
			}
			
		} catch (error) {
			
			console.error("VersionedSet update failed: " + error);
			
		}

	}
	
	async commit(changes) {
		
		//Create update message
		var updateMessage = new UpdateMessage();
		
		updateMessage.source = host.id;
		
		updateMessage.data = {
			prev: this.latestUpdate,
			admins: this.adminsHLT,
			version: this.version,
			changes: changes
		};
		
		await host.signMessage(updateMessage);
		
		this.latestUpdate = await host.storeResourceObject(updateMessage);
		
		console.log("Update: " + JSON.stringify(updateMessage, null, 2)
			+ "->" + this.latestUpdate);

	}
	
	async addAdmin(newAdminID) {
		
		//newAdmin must be a valid host ID
		console.log("Adding set amdin: ID="+newAdminID);

		//Check if admin was not already present
		if(await this.admins.has(newAdminID)) {
			
			console.log("addAdmin failed: id already in set");
			
		} else {
			
			//Perform local changes
			this.adminsHLT = await this.admins.add(newAdminID);

			await this.commit({
				addAdmin: newAdminID
			});
		}
		
	}
	
	
};
