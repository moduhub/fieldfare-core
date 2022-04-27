/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const HashLinkedList = require('../structures/HashLinkedList.js');
const HashLinkedTree = require('../structures/HashLinkedTree.js');

const VersionStatement = require('./VersionStatement.js');


module.exports = class VersionedData {

	constructor() {

		this.vdata = {
			admins: new HashLinkedTree(5)
		}

		this.version = '';

	}

	apply(changes) {

		//handle addAdmin here

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

	static jsonReplacer(key, value) {

		if(value instanceof HashLinkedTree
		|| value instanceof HashLinkedList) {
			return value.getState();
		}

		return value;
	}

	async commit(changes) {

		//Create update message
		var versionStatement = new VersionStatement();

		versionStatement.source = host.id;

		versionStatement.data = {
			prev: this.version,
			vdata: JSON.stringify(this.vdata, VersionedData.jsonReplacer),
			changes: changes
		};

		await host.signMessage(versionStatement);

		this.version = await host.storeResourceObject(versionStatement);

		console.log("Update: " + JSON.stringify(versionStatement, null, 2).replaceAll('\\', '')
			+ "->" + this.version);

	}

	async auth(strict=true) {

		if(await this.vdata.admins.isEmpty() !== false) {

			console.log("Checking if I am authorized");

			if(await this.vdata.admins.has(host.id) == false) {
				throw 'addAdmin failed: not authorized';
			} else {
				console.log(">>> Auth ok");
			}

		} else {
			if(strict) {
				throw 'strict auth failed, admin group empty';
			} else {
				console.log("Admin group is empty, strict=false, auth ok");
			}
		}
	}

	async addAdmin(newAdminID) {

		//newAdmin must be a valid host ID
		console.log("VersionedData.addAdmin ID="+newAdminID);

		//Check if admin was not already present
		if(await this.vdata.admins.has(newAdminID)) {

			throw 'addAdmin failed: id already in set';

		}

		//Check auth, non strict
		this.auth(false);

		//Perform local changes
		await this.vdata.admins.add(newAdminID);

		await this.commit({
			addAdmin: newAdminID
		});
	}

};
