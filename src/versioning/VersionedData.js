/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {LocalHost} from '../env/LocalHost';
import {ResourcesManager} from '../resources/ResourcesManager';
import {HashLinkedList} from '../structures/HashLinkedList';
import {HashLinkedTree} from '../structures/HashLinkedTree';
import {VersionStatement} from './VersionStatement';
import {VersionChain} from './VersionChain';
import {NVD} from '../basic/NVD';
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';


export class VersionedData {

	constructor() {

		this.elements = new Map();
		this.methods = new Map();

		this.addSet('admins');

		this.methods.set('addAdmin', this.applyAddAdmin.bind(this));

		this.version = '';

		this.versionBlacklist = new Set();

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

	async applyChain(chain, merge=false) {

		//just accept remote changes
		const changes = await chain.getChanges();
		// logger.log('info', "remoteChanges:" + JSON.stringify(remoteChanges));
		for await (const [issuer, method, params] of changes) {
			if(method === 'merge') {

				const mergeChain = new VersionChain(params.head, chain.owner, chain.maxDepth);
				mergeChain.limit(params.base);
				await this.applyChain(mergeChain, true);
			} else {
				logger.debug('await this.apply('+ issuer + ',' + method + ',' + JSON.stringify(params) + ')');
				await this.apply(issuer, method, params, merge);
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

		const statement = await ResourcesManager.getResourceObject(version);

		const stateKey = statement.data.state;

		// logger.log('info', "State key: \'" + stateKey + '\'');

		if(stateKey !== '') {

			const state = await ResourcesManager.getResourceObject(statement.data.state);

			// logger.log('info', "Revert to state object: " + JSON.stringify(state));

			this.setState(state);

		} else {

			// logger.log('info', 'Revert to NULL state');

			this.resetState();
		}

		this.version = version;

	}

	async update(version, owner) {

		if(this.updateInProgress === version) {
			//Already updating to same version, consider success?
			return;
		}

		if(this.updateInProgress) {
			throw Error('another update in progress');
		}

		if(this.versionBlacklist.has(version)) {
			throw Error('This version has been blacklisted');
		}

		logger.debug(">> Env update to version: " + version);

		this.updateInProgress = version;

		const receivedMessage = await VersionStatement.fromResource(version, owner);

		logger.debug("Received update statement: " + JSON.stringify(receivedMessage,null, 2));

		const localChain = new VersionChain(this.version, LocalHost.getID(), 50);
		const remoteChain = new VersionChain(version, owner, 50);

		const commonVersion = await VersionChain.findCommonVersion(localChain, remoteChain);

		//Limit to commonVersion, not including
		localChain.limit(commonVersion, false);
		remoteChain.limit(commonVersion, false);

		logger.debug("Common version is " + commonVersion);

		const localCommitsAhead = await localChain.length();
		const remoteCommitsAhead = await remoteChain.length();

		logger.debug("Local env is " + localCommitsAhead + " commits ahead");
		logger.debug("Remote env is " + remoteCommitsAhead + " commits ahead");

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

				await this.applyChain(remoteChain);

				const stateKey = await ResourcesManager.storeResourceObject(await this.getState());
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

					const stateAfterMergeKey = await ResourcesManager.storeResourceObject(await this.getState());

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
				await NVD.save(this.uuid, this.version);

				// Reset blacklist
				this.versionBlacklist.clear();

				logger.debug('Environment ' + this.uuid + ' updated successfully to version ' + this.version);

			} catch (error) {

				// Recover previous state
				await this.revertToVersion(localChain.head);

				throw Error('environment changes apply all failed: ', {cause: error});

			} finally {
				this.updateInProgress = null;
			}

		} else {

			this.updateInProgress = null;

			logger.debug("Local chain is ahead of remote chain, nothing to do");

			//Local chain is ahead of remote, wait for remote to merge
			// Todo: notify him?
		}

	}

	async commit(changes) {

		//Create update message
		var versionStatement = new VersionStatement();

		versionStatement.source = LocalHost.getID();

		const stateResource = await ResourcesManager.storeResourceObject(await this.getState());

		versionStatement.data = {
			prev: this.version,
			state: stateResource,
			changes: await ResourcesManager.storeResourceObject(changes)
		};

		await LocalHost.signMessage(versionStatement);

		this.version = await ResourcesManager.storeResourceObject(versionStatement);

		logger.log('info', "New version statement: " + JSON.stringify(versionStatement, null, 2)//.replaceAll('\\', '')
			+ "->" + this.version);

	}

	async auth(id, strict=true) {
		if(Utils.isBase64(id) == false) {
			throw Error('invalid id parameter');
		}
		const admins = this.elements.get('admins');
		if(await admins.isEmpty()) {
			if(strict) {
				throw Error('strict auth failed, admin group empty');
			}
		} else {
			if(await admins.has(id) === false) {
				throw Error('not authorized');
			}
		}
		logger.debug('>> ' + id + ' auth OK');
	}

	async applyAddAdmin(issuer, params, merge=false) {

		logger.debug("applyAddAdmin params: " + JSON.stringify(params));

		Utils.validateParameters(params, ['id']);

		const newAdminID = params.id;
		ResourcesManager.validateKey(newAdminID);

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

		await this.applyAddAdmin(LocalHost.getID(), params);

		await this.commit({
			addAdmin: params
		});

		await NVD.save(this.uuid, this.version);

	}

};
