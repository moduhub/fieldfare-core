/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const HashLinkedList = require('../structures/HashLinkedList.js');
const HashLinkedTree = require('../structures/HashLinkedTree.js');

const VersionStatement = require('./VersionStatement.js');
const VersionChain = require('./VersionChain.js');

const Utils = require('../basic/Utils.js');


module.exports = class VersionedData {

	constructor() {

		this.vdata = {
			admins: new HashLinkedTree(5)
		}

		this.version = '';

	}

	apply(issuer, method, params) {

		//handle addAdmin here
		switch(method) {
			case 'addAdmin' : {
				this.applyAddAdmin(issuer, params);
			} break;

			default: {
				throw Error('apply failed: unknown change method ' + method);
			} break;
		}
	}

	async revertToVersion(version) {

		console.log("REVERTING TO VERSION: "  + version);

	}

	async update(version, owner) {

		console.log("Received update version: " + version);

		const receivedMessage = await VersionStatement.fromResource(version, owner);

		console.log("Received update statement " + JSON.stringify(receivedMessage));

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
		}

		//just accept remote changes
		const changes = await remoteChain.getChanges();

		for await (const [method, params] of changes) {

			try {

				await this.apply(statement.source, method, params);

				if(statement.data.version) {
					throw Error('version mismatch after changes applied');
				}

			} catch (error) {

				this.revertToVersion();

				throw Error('environment changes apply all failed: ', {cause: error});

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

	getState() {

		//Store transformed vdata
		const transformedState = JSON.parse(JSON.stringify(this.vdata, VersionedData.jsonReplacer));

		console.log("Transformed state: " + JSON.stringify(transformedState, null, 2));

		return host.storeResourceObject(transformedState);
	}

	async commit(changes) {

		//Create update message
		var versionStatement = new VersionStatement();

		versionStatement.source = host.id;

		versionStatement.data = {
			prev: this.version,
			state: await this.getState(),
			changes: await host.storeResourceObject(changes)
		};

		await host.signMessage(versionStatement);

		this.version = await host.storeResourceObject(versionStatement);

		console.log("New version statement: " + JSON.stringify(versionStatement, null, 2)//.replaceAll('\\', '')
			+ "->" + this.version);

	}

	async auth(id, strict=true) {

		if(Utils.isBase64(id) == false) {
			throw Error('invalid id parameter');
		}

		if(await this.vdata.admins.isEmpty() !== false) {

			console.log("Checking if I am authorized");

			if(await this.vdata.admins.has(id) == false) {
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

	async applyAddAdmin(issuer, newAdminID) {

		//newAdmin must be a valid host ID
		console.log("APPLY >> VersionedData.applyAddAdmin ID=" + newAdminID + ' from ' + issuer);

		//Check if admin was not already present
		if(await this.vdata.admins.has(newAdminID)) {
			throw Error('applyAddAdmin failed: id already in set');
		}

		//Check auth, non strict
		this.auth(issuer, false);

		//Perform local changes
		await this.vdata.admins.add(newAdminID);

	}

	async addAdmin(newAdminID) {

		//newAdmin must be a valid host ID
		console.log("VersionedData.addAdmin ID="+newAdminID);

		this.applyAddAdmin(host.id, newAdminID);

		await this.commit({
			addAdmin: newAdminID
		});

	}

};
