/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const HashLinkedTree = require('../Structures/HashLinkedTree.js');

const VersionStatement = require('./VersionStatement.js');


module.exports = class VersionedData {

	constructor() {

		this.adminsHLT = '';

		this.admins = new HashLinkedTree(5);

		this.version = '';

	}

	apply(changes) {
		throw 'Versioned data apply() not defined';
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
		var versionStatement = new VersionStatement();

		versionStatement.source = host.id;

		versionStatement.data = {
			prev: this.version,
			admins: this.adminsHLT,
			changes: changes
		};

		await host.signMessage(versionStatement);

		this.version = await host.storeResourceObject(versionStatement);

		console.log("Update: " + JSON.stringify(versionStatement, null, 2)
			+ "->" + this.version);

	}

	async addAdmin(newAdminID) {

		//newAdmin must be a valid host ID
		console.log("VersionedData.addAdmin ID="+newAdminID);

		//Check if admin was not already present
		if(await this.admins.has(newAdminID)) {

			throw 'addAdmin failed: id already in set';

		}

		//Check auth
		if(await this.admins.isEmpty() !== false) {

			console.log("Checking if I am authorized");

			if(await this.admins.has(host.id) == false) {
				throw 'addAdmin failed: not authorized';
			} else {
				console.log("Ok auth!!");
			}

		} else {

			console.log("Admin group is empty, auth ok");

		}

		//Perform local changes
		this.adminsHLT = await this.admins.add(newAdminID);

		await this.commit({
			addAdmin: newAdminID
		});
	}
};
