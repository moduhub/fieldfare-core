/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const HashLinkedTree = require('./HashLinkedTree.js');

const VersionStatement = require('./VersionStatement.js');


module.exports = class VersionedData {
	
	constructor() {
		
		this.adminsHLT = '';
		this.latestUpdate = '';
		
		this.admins = new HashLinkedTree(5);
		
		this.version = '';
		
	}

	async update(pMessage) {
		
		await VersionStatement.validate(pMessage);

		try {
		
			var chain = await pMessage.buildChain(this.version, 50);
			
			//Perform changes sequentially
			for await (const iMessage of chain) {
			
				await VersionStatement.validate(iMessage);
			
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
