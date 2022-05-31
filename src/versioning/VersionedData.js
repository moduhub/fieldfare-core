/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {
	HashLinkedList,
	HashLinkedTree,
	VersionStatement,
	VersionChain,
	Utils,
	logger
} from 'mhlib';

export class VersionedData {

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

		if(merge) logger.log('info', '>>MERGE ' + methodName + ' params: ' + JSON.stringify(params));

		await methodCallback(issuer, params, merge);

	}

	async revertToVersion(version) {

		// logger.log('info', "REVERTING TO VERSION: "  + version);

		const statement = await host.getResourceObject(version);

		const stateKey = statement.data.state;

		// logger.log('info', "State key: \'" + stateKey + '\'');

		if(stateKey !== '') {

			const state = await host.getResourceObject(statement.data.state);

			// logger.log('info', "Revert to state object: " + JSON.stringify(state));

			this.setState(state);

		} else {

			// logger.log('info', 'Revert to NULL state');

			this.resetState();
		}

		this.version = version;

	}

	async update(version, owner) {

		logger.log('info', ">> Env update to version: " + version);

		const receivedMessage = await VersionStatement.fromResource(version, owner);

		// logger.log('info', "Received update statement " + JSON.stringify(receivedMessage));

		var localChain = new VersionChain(this.version, host.id, 50);
		var remoteChain = new VersionChain(version, owner, 50);

		var commonVersion = await VersionChain.findCommonVersion(localChain, remoteChain);

		//Limit to commonVersion, not including
		localChain.limit(commonVersion, false);
		remoteChain.limit(commonVersion, false);

		logger.log('info', "Common version is " + commonVersion);

		const localCommitsAhead = await localChain.length();
		const remoteCommitsAhead = await remoteChain.length();

		logger.log('info', "Local env is " + localCommitsAhead + " commits ahead");
		logger.log('info', "Remote env is " + remoteCommitsAhead + " commits ahead");

		// 		1) I have concurrent changes
		// && 	2) remote chain is LoggerManager
		// 			so... stash localChanges and perform remote before
		if(remoteCommitsAhead > 0
		&& remoteCommitsAhead >= localCommitsAhead) {

			if(localCommitsAhead > 0) {
				// logger.log('info', "Stashing local changes");
				await this.revertToVersion(commonVersion);
			}

			try {

				//just accept remote changes
				const remoteChanges = await remoteChain.getChanges();

				// logger.log('info', "remoteChanges:" + JSON.stringify(remoteChanges));

				for await (const [issuer, method, params] of remoteChanges) {

					// const stateBefore = await host.storeResourceObject(await this.getState());
					// logger.log('info', "State before apply: " + JSON.stringify(this.getState(), null, 2)
					// 	+ ' => ' + stateBefore);
					//
					// logger.log('info', 'await this.apply('+ issuer + ',' + method + ',' + JSON.stringify(params) + ')');
					await this.apply(issuer, method, params);
					//
					// const stateAfter = await host.storeResourceObject(await this.getState());
					// logger.log('info', "State after apply: " + JSON.stringify(this.getState(), null, 2)
					// 	+ ' => ' + stateAfter);

				}

				const stateKey = await host.storeResourceObject(await this.getState());
				const expectedState = await remoteChain.getHeadState();

				// logger.log('info', "state after apply: " + stateKey);
				// logger.log('info', "expected state: " + expectedState);

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

			logger.log('info', "Local chain is ahead of remote chain, nothing to do");

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

		logger.log('info', "New version statement: " + JSON.stringify(versionStatement, null, 2)//.replaceAll('\\', '')
			+ "->" + this.version);

	}

	async auth(id, strict=true) {

		if(Utils.isBase64(id) == false) {
			throw Error('invalid id parameter');
		}

		const admins = this.elements.get('admins');

		if(await admins.isEmpty() !== false) {
			if(await admins.has(id) === false) {
				throw Error('not authorized');
			}
		} else {
			if(strict) {
				throw Error('strict auth failed, admin group empty');
			}
		}

		logger.log('info', '>> ' + id + ' auth OK');
	}

	async applyAddAdmin(issuer, params, merge=false) {

		logger.log('info', "applyAddAdmin params: " + JSON.stringify(params));

		VersionedData.validateParameters(params, ['id']);

		const newAdminID = params.id;

		if(Utils.isBase64(newAdminID) === false) {
			throw Error('invalid admin ID');
		}

		//newAdmin must be a valid host ID
		logger.log('info', "APPLY >> VersionedData.applyAddAdmin ID=" + newAdminID
		 	+ ' from ' + issuer);

		const admins = this.elements.get('admins');

		logger.log('info', "Current admins: ");
		for await (const admin of admins) {
			logger.log('info', '> ' + admin);
		}

		//Check if admin was not already present
		if(await admins.has(newAdminID)) {
			if(merge) {
				logger.log('info', 'applyAddAdmin successfully MERGED');
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
		logger.log('info', "VersionedData.addAdmin ID="+newAdminID);

		await this.applyAddAdmin(host.id, params);

		await this.commit({
			addAdmin: params
		});

		await nvdata.save(this.uuid, this.version);

	}

};
