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

	apply(method, params, finalVersion) {

		//handle addAdmin here
		switch(method) {
			case 'addAdmin' : {
				//this.addAdmin(params);
				console.log("APPLY> addAdmin(" + JSON.stringify(params) + ")");
				return true;
			} break;

			default: {
				throw Error('apply failed: unknown change method ' + method);
			} break;
		}

		if(this.version != finalVersion) {
			throw Error('invalid change, final version difference');
		}

		console.log("Change apply successful!");
	}

	async update(version, owner) {

		const receivedMessage = await VersionStatement.fromResource(version, owner);

		console.log("Received update " + JSON.stringify(receivedMessage));

		var localChain = new VersionChain(this.version, host.id, 50);
		var remoteChain = new VersionChain(version, owner, 50);

		var commonVersion = await VersionChain.findCommonVersion(localChain, remoteChain);

		localChain.limit(commonVersion);
		remoteChain.limit(commonVersion);

		console.log("Common version is " + commonVersion);

		const localCommitsAhead = await localChain.length();
		const remoteCommitsAhead = await remoteChain.length();

		console.log("Local env is " + localCommitsAhead + " commits ahead");
		console.log("Remote env is " + remoteCommitsAhead + " commits ahead");

		// Merge!
		if(localCommitsAhead > 0 && remoteCommitsAhead > 0) {
			//I have concurrent changes, stash them and perform remote before
			console.log("TODO: Stash changes!");
		} else {

			//just accept remote changes
			for await (const [version, statement] of remoteChain) {

				for(const prop in statement.data.change) {

					const params = await host.getResourceObject(statement.data.change[prop]);

					if(await this.apply(prop, params, statement.data.version) == false) {

						//revert?

						throw Error('Update rejected due to invalid chain');
					}

				}
			}

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
				throw Error('addAdmin failed: not authorized');
			} else {
				console.log(">>> Auth ok");
			}

		} else {
			if(strict) {
				throw Error('strict auth failed, admin group empty');
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

			throw Error('addAdmin failed: id already in set');

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
