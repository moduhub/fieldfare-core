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

	async apply(issuer, method, params) {

		//handle addAdmin here
		switch(method) {
			case 'addAdmin' : {
				await this.applyAddAdmin(issuer, params);
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

		// 		1) I have concurrent changes
		// && 	2) remote chain is LoggerManager
		// 			so... stash localChanges and perform remote before
		if(remoteCommitsAhead > localCommitsAhead) {

			if(localCommitsAhead > 0) {
				console.log("Stashing local changes");
				this.revertToVersion(commonVersion);
			}

			try {

				//just accept remote changes
				const remoteChanges = await remoteChain.getChanges();

				console.log("remoteChanges:" + JSON.stringify(remoteChanges));

				for await (const [issuer, method, params] of remoteChanges) {
					console.log('await this.apply('+ issuer + ',' + method + ',' + JSON.stringify(params) + ')');
					await this.apply(issuer, method, params);
				}

				const stateKey = await host.storeResourceObject(await this.getState());
				const expectedState = await remoteChain.getHeadState();

				console.log("state after apply: " + stateKey);
				console.log("expected state: " + expectedState);

				if(stateKey !== expectedState) {
					throw Error('version mismatch after changes applied');
				}

				this.version = remoteChain.version;

				const localChanges = await localChain.getChanges();

				//now merge local changes at end of remote chain
				for await (const [method, params] of localChanges) {
					console.log('await this.change(' + method + ',' + JSON.stringify(params) + ')');
				}

			} catch (error) {

				// Recover previous state
				this.revertToVersion(localChain.head);

				throw Error('environment changes apply all failed: ', {cause: error});

			}

		} else {

			console.log("Local chain is ahead of remote chain, nothing to do");

			//Local chain is ahead of remote, wait for remote to merge
			// Todo: notify him?
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

		console.log("Current admins: ")
		for await (const admin of this.vdata.admins) {
			console.log('> ' + admin);
		}

		//Check if admin was not already present
		if(await this.vdata.admins.has(newAdminID)) {
			throw Error('applyAddAdmin failed: id already in set');
		}

		//Check auth, non strict
		await this.auth(issuer, false);

		//Perform local changes
		await this.vdata.admins.add(newAdminID);

	}

	async addAdmin(newAdminID) {

		//newAdmin must be a valid host ID
		console.log("VersionedData.addAdmin ID="+newAdminID);

		await this.applyAddAdmin(host.id, newAdminID);

		await this.commit({
			addAdmin: newAdminID
		});

	}

};
