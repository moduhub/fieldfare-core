/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const HashLinkedList = require('../structures/HashLinkedList.js');
const HashLinkedTree = require('../structures/HashLinkedTree.js');

const VersionStatement = require('./VersionStatement.js');
const VersionChain = require('./VersionChain.js');


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

	async update(version, owner) {

		const receivedMessage = await VersionStatement.fromResource(version, owner);

		console.log("Received update " + JSON.stringify(receivedMessage));

		var localChain = new VersionChain(this.version, host.id, 50);
		var remoteChain = new VersionChain(version, owner, 50);

		var commonVersion = await VersionChain.findCommonVersion(localChain, remoteChain);

		console.log("Common version is " + commonVersion);
		console.log("Local env is " + await localChain.length(commonVersion) + " commits ahead");
		console.log("Remote env is " + await remoteChain.length(commonVersion) + " commits ahead");

		// //Perform changes sequentially
		// for await (const message of chain) {
		//
		// 	await VersionStatement.validate(message);
		//
		// 	console.log("Change: " + message.data.changes);
		//
		// 	// if(await this.apply(iMessage.data.change, iMessage.data.version) == false) {
		// 	// 	throw 'Update rejected due to invalid chain';
		// 	// }
		// }

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
