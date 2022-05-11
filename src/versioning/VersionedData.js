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

		this.elements = new Map();
		this.methods = new Map();

		this.addSet('admins');

		this.methods.set('addAdmin', this.applyAddAdmin.bind(this));

		this.version = '';

	}

	addSet(name) {
		this.elements.set(name, new HashLinkedTree(5));
	}

	addList(name) {
		this.elements.set(name, new HashLinkedList());
	}

	getState() {

		var state = {};

		for(const [name, element] of this.elements) {
			const elementState = element.getState();
			state[name] = elementState;
		}

		return state;
	}

	setState(state) {

		for(const prop in state) {

			const value = state[prop];

			if(this.elements.has(prop) === false) {
				this.addSet(prop);
			}

			const element = this.elements.get(prop);
			element.setState(value);
		}

		//remove elements not in stateID
		for(const [name, element] of this.elements) {
			if(name in state === false) {
				this.elements.delete(name);
			}
		}

	}

	resetState() {

		for(const [name, element] of this.elements) {
			element.setState('');

			//remove references to all service provider lists
			if(name.search('.providers') != -1) {
				this.elements.delete(name);
			}
		}
	}

	static validateParameters(params, expectedNames) {

		for(const prop in params) {
			if(expectedNames.includes(prop) === false) {
				throw Error('unxpected parameter: ' + prop);
			}
		}

		for(const name of expectedNames) {
			if(name in params === false) {
				throw Error('missing parameter: ' + name);
			}
		}
	}

	async apply(issuer, methodName, params, merge=false) {

		const methodCallback = this.methods.get(methodName);

		if(!methodCallback) {
			throw Error('apply failed: unknown change method ' + methodName);
		}

		if(merge) console.log('>>MERGE ' + methodName + ' params: ' + JSON.stringify(params));

		await methodCallback(issuer, params, merge);

	}

	async revertToVersion(version) {

		console.log("REVERTING TO VERSION: "  + version);

		const statement = await host.getResourceObject(version);

		const stateKey = statement.data.state;

		// console.log("State key: \'" + stateKey + '\'');

		if(stateKey !== '') {

			const state = await host.getResourceObject(statement.data.state);

			// console.log("Revert to state object: " + JSON.stringify(state));

			this.setState(state);

		} else {

			// console.log('Revert to NULL state');

			this.resetState();
		}

		this.version = version;

	}

	async update(version, owner) {

		console.log(">> Env update to version: " + version);

		const receivedMessage = await VersionStatement.fromResource(version, owner);

		// console.log("Received update statement " + JSON.stringify(receivedMessage));

		var localChain = new VersionChain(this.version, host.id, 50);
		var remoteChain = new VersionChain(version, owner, 50);

		var commonVersion = await VersionChain.findCommonVersion(localChain, remoteChain);

		//Limit to commonVersion, not including
		localChain.limit(commonVersion, false);
		remoteChain.limit(commonVersion, false);

		console.log("Common version is " + commonVersion);

		const localCommitsAhead = await localChain.length();
		const remoteCommitsAhead = await remoteChain.length();

		console.log("Local env is " + localCommitsAhead + " commits ahead");
		console.log("Remote env is " + remoteCommitsAhead + " commits ahead");

		// 		1) I have concurrent changes
		// && 	2) remote chain is LoggerManager
		// 			so... stash localChanges and perform remote before
		if(remoteCommitsAhead > 0
		&& remoteCommitsAhead >= localCommitsAhead) {

			if(localCommitsAhead > 0) {
				// console.log("Stashing local changes");
				await this.revertToVersion(commonVersion);
			}

			try {

				//just accept remote changes
				const remoteChanges = await remoteChain.getChanges();

				// console.log("remoteChanges:" + JSON.stringify(remoteChanges));

				for await (const [issuer, method, params] of remoteChanges) {

					// const stateBefore = await host.storeResourceObject(await this.getState());
					// console.log("State before apply: " + JSON.stringify(this.getState(), null, 2)
					// 	+ ' => ' + stateBefore);
					//
					// console.log('await this.apply('+ issuer + ',' + method + ',' + JSON.stringify(params) + ')');
					await this.apply(issuer, method, params);
					//
					// const stateAfter = await host.storeResourceObject(await this.getState());
					// console.log("State after apply: " + JSON.stringify(this.getState(), null, 2)
					// 	+ ' => ' + stateAfter);

				}

				const stateKey = await host.storeResourceObject(await this.getState());
				const expectedState = await remoteChain.getHeadState();

				// console.log("state after apply: " + stateKey);
				// console.log("expected state: " + expectedState);

				if(stateKey !== expectedState) {
					throw Error('version mismatch after remote changes applied');
				}

				this.version = remoteChain.head;

				const localChanges = await localChain.getChanges();

				//now merge local changes at end of remote chain, if any
				if(localCommitsAhead > 0) {

					for await (const [issuer, method, params] of localChanges) {
						await this.apply(issuer, method, params, true);
					}

					const stateAfterMergeKey = await host.storeResourceObject(await this.getState());

					//only commit if changes were not redundant
					if(stateAfterMergeKey !== expectedState) {
						await this.commit({
							merge: {
								head: localChain.head,
								base: localChain.base}
							}
						);
					}
				}

				//Save changes permanently
				await nvdata.save(this.uuid, this.version);

			} catch (error) {

				// Recover previous state
				await this.revertToVersion(localChain.head);

				throw Error('environment changes apply all failed: ', {cause: error});

			}

		} else {

			console.log("Local chain is ahead of remote chain, nothing to do");

			//Local chain is ahead of remote, wait for remote to merge
			// Todo: notify him?
		}

	}

	async commit(changes) {

		//Create update message
		var versionStatement = new VersionStatement();

		versionStatement.source = host.id;

		const stateResource = await host.storeResourceObject(await this.getState());

		versionStatement.data = {
			prev: this.version,
			state: stateResource,
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

		const admins = this.elements.get('admins');

		if(await admins.isEmpty() !== false) {
			if(await admins.has(id) == false) {
				throw Error('addAdmin failed: not authorized');
			}
		} else {
			if(strict) {
				throw Error('strict auth failed, admin group empty');
			}
		}

		console.log('>> ' + id + ' auth OK');
	}

	async applyAddAdmin(issuer, params, merge=false) {

		console.log("applyAddAdmin params: " + JSON.stringify(params));

		VersionedData.validateParameters(params, ['id']);

		const newAdminID = params.id;

		if(Utils.isBase64(newAdminID) === false) {
			throw Error('invalid admin ID');
		}

		//newAdmin must be a valid host ID
		console.log("APPLY >> VersionedData.applyAddAdmin ID=" + newAdminID
		 	+ ' from ' + issuer);

		const admins = this.elements.get('admins');

		console.log("Current admins: ");
		for await (const admin of admins) {
			console.log('> ' + admin);
		}

		//Check if admin was not already present
		if(await admins.has(newAdminID)) {
			if(merge) {
				console.log('applyAddAdmin successfully MERGED');
				return;
			} else {
				throw Error('applyAddAdmin failed: id already in set');
			}
		}

		//Check auth, non strict
		await this.auth(issuer, false);

		//Perform local changes
		await admins.add(newAdminID);

	}

	async addAdmin(newAdminID) {

		const params = {id: newAdminID};

		//newAdmin must be a valid host ID
		console.log("VersionedData.addAdmin ID="+newAdminID);

		await this.applyAddAdmin(host.id, params);

		await this.commit({
			addAdmin: params
		});

		await nvdata.save(this.uuid, this.version);

	}

};
