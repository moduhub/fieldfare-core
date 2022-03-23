/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const HashLinkedTree = require('./HashLinkedTree.js');

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

module.exports = class VersionedSet {
	
	constructor() {
		
		this.adminsHLT = '';
		this.elementsHLT = '';
		
		this.admins = new HashLinkedTree(5);
		this.elements = new HashLinkedTree(5);
			
	}

	async update(message) {
		
		await UpdateMessage.validate(message);

		try {
		
			var chain = await message.buildChain(this.currentVersion, 50);
			
			var newTree = Object.assign(new HashLinkedTree, this.elements);
			
			//Perform changes
			for(let message in chain) {
				
				if('add' in message.data) {
					
					message.data.add.forEach(element => {
						newTree.add();
					});
				
				}
				
				this.currentVersion = message.data.version;
			}
			
			//check if final version matches message specified version
			
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
			elements: this.elementsHLT,
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
	
	//Perform local add
	async addElement(newElement) {

		const newElementHash = await host.generateResourceHash(newElement);

		console.log("Adding new element: " + newElementHash);
		
		//Check if element was not already present
		if(await this.elements.has(newElementHash)) {
			
			console.log("addElement failed: hash already in set");
			
		} else {
		
			//Perform local changes
			this.elementsHLT = await this.elements.add(newElement);

			await this.commit({
				addElement: newElementHash
			});
		}
		
	}
};