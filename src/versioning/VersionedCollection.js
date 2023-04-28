/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalHost } from '../env/LocalHost.js';
import { Chunk } from '../chunking/Chunk.js';
import { ChunkingUtils } from '../chunking/ChunkingUtils.js';
import { ChunkMap } from '../structures/ChunkMap.js';
import { VersionStatement } from './VersionStatement.js';
import { VersionChain } from './VersionChain.js';
import { NVD } from '../basic/NVD.js';
import { Utils } from '../basic/Utils.js';
import { logger } from '../basic/Log.js';
import { Collection } from '../structures/Collection.js';
import { Change } from './Change.js';

/**
 * Represents a group of elements that can be altered
 * by a group of hosts in a collaborative manner. Any changes made to
 * the data must be commited by creating VersionStatements and sharing
 * them with all other hosts in the admin group, that may accept or
 * reject the changes based on a shared set of rules.
 */
export class VersionedCollection {

	constructor(uuid) {
		if(!uuid) {
			throw Error('uuid must be defined');
		}
		if(Utils.isUUID(uuid) === false) {
			throw Error('invalid uuid');
		}
		this.uuid = uuid;
		/**
		 * Name of the methods that can be used to alter the collection elements 'legally'.
		 * Any remote call to a method outside this set will be blocked.
		 * @type {Set<string, CollectionMethod>}
		 */
		this.allowedChanges = new Set([
			'createElement', 'deleteElement'
		]);
		/**
		 * A local copy of the collection, containing the version last checked out.
		 * @type {Collection}
		 */
		this.localCopy = new Collection(uuid);
		this.localCopy.publish();
		/**
		 * The version identifier is a string that identifies the current version of the collection
		 * using the chunk identifier assigned to the lastest version statement.
		 * @type {string}
		 */
		this.currentVersion = '';
		/**
		 * The version blacklist contains a set of version identifiers previously rejected by the
		 * local host. This is used to avoid re-checking out a version that was already rejected.
		 * @type {Set<string>}
		 */
		this.versionBlacklist = new Set();
	}

	async init(){
		await this.localCopy.loadPersistentState();
		this.currentVersion = await this.localCopy.getState();
		Collection.track(this.uuid, (remoteCollection) => {
			logger.debug('Versioned collection '+this.uuid+' received remote host update ' + remoteCollection.owner);
			remoteCollection.getElement('version').then((versionChunk) => {
				logger.debug('Detected version statement ' + versionChunk.id + ' in remote collection');
				if(versionChunk) {
					this.pull(versionChunk.id, remoteCollection.owner);
				}
			});
		});
	}

	async applyChain(chain, merge=false) {
		//just accept remote changes
		const changes = await chain.getChanges();
		logger.log('info', "applyChain: changes:" + JSON.stringify(changes));
		for await (const changeDescriptor of changes) {
			if(changeDescriptor.method === 'merge') {
				const mergeChain = new VersionChain(params.head, chain.owner, chain.maxDepth);
				mergeChain.limit(params.base);
				await this.applyChain(mergeChain, true);
			} else {
				logger.debug('await this.apply('
					+ changeDescriptor.issuer + ',' 
					+ changeDescriptor.method + ',' 
					+ JSON.stringify(changeDescriptor.params) + ')');
				if(merge) {
					logger.log('info', '>>MERGE ' + changeDescriptor.method
						+ ' params: ' + JSON.stringify(changeDescriptor.params));
				}
				const change = await this.getChangeFromDescriptor(changeDescriptor);
				await change.execute(merge);
			}
		}
	}

	/**
	 * Apply a change to the collection elements.
	 * @param {Change} change
	 * @param {boolean} merge
	 */
	async getChangeFromDescriptor(descriptor) {
		if(this.allowedChanges.has(descriptor.method) === false) {
			throw Error('change is not allowed ' + change.methodName);
		}
		const classMethod = this[descriptor.method];
		if(!classMethod) {
			throw Error('change is not defined ' + change.method);
		}
		const change = classMethod(...descriptor.params).bind(this);
		if(change instanceof Change === false) {
			throw Error('class method ' + change.method + ' does not return a Change object');
		}
		if(descriptor.issuer) {
			change.setIssuer(descriptor.issuer);
		}
		return change;
	}

	/**
	 * Force update to a given version, discarding any local changes.
	 * @param {string} version identifier of the version to update to.
	 * @param {string} hostIdentifier Host identifier from where the changes should be fetched.
	 */
	async checkout(version, hostIdentifier) {
		const versionChunk = Chunk.fromIdentifier(version, hostIdentifier);
		const statement = await VersionStatement.fromDescriptor(versionChunk);
		await this.localCopy.setState(statement.data.state);
		this.currentVersion = version;
	}

	/**
	 * Update to a given version, fetching changes from a given source host.
	 * @param {string} version 
	 * @param {HostIdentifier} source 
	 * @returns 
	 */
	async pull(version, source) {
		ChunkingUtils.validateIdentifier(version);
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
		logger.debug(">> pull changes to version: " + version);
		this.updateInProgress = version;
		const versionChunk = Chunk.fromIdentifier(version, source);
		const versionStatement = await VersionStatement.fromDescriptor(versionChunk);
		logger.debug("Received version statement: " + JSON.stringify(versionStatement,null, 2));
		const localChain = new VersionChain(this.currentVersion, LocalHost.getID(), 50);
		const remoteChain = new VersionChain(version, source, 50);
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
		// && 	2) remote chain is longer
		// 			so... stash localChanges and perform remote before
		if(remoteCommitsAhead > 0
		&& remoteCommitsAhead >= localCommitsAhead) {
			if(localCommitsAhead > 0) {
				// logger.log('info', "Stashing local changes");
				await this.checkout(commonVersion);
			}
			try {
				const stateBeforeApply = await this.localCopy.getState();
				logger.debug("state before apply: " + stateBeforeApply);
				await this.applyChain(remoteChain);
				const achievedState = await this.localCopy.getState();
				const expectedState = await remoteChain.getHeadDescriptor();
				logger.debug("state after apply: " + achievedState);
				logger.debug("expected state: " + expectedState);
				if(achievedState !== expectedState) {
					throw Error('state mismatch after remote changes applied');
				}
				this.currentVersion = remoteChain.head;
				//now merge local changes at end of remote chain, if any
				if(localCommitsAhead > 0) {
					this.applyChain(localChain, true);
					const descriptorChunk = await Chunk.fromObject(this.elements.descriptor);
					//only commit if changes were not redundant
					if(descriptorChunk.id !== expectedState) {
						await this.commit({
							merge: {
								head: localChain.head,
								base: localChain.base
							}
						});
					}
				}
				this.versionBlacklist.clear();
				logger.debug('Environment ' + this.uuid + ' updated successfully to version ' + this.currentVersion);
			} catch (error) {
				// Recover previous state
				await this.checkout(localChain.head);
				throw Error('environment changes apply all failed: ' + error, {cause: error});
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

	/**
	 * Execute a set of changes and create a new version.
	 */
	async commit(changes) {
		if(changes instanceof Array === false) {
			changes = [changes];
		}
		const prevState = await this.localCopy.getState();
		const changeDescriptors = [];
		for(const change of changes) {
			if(change instanceof Change === false) {
				throw Error('Invalid change');
			}
			change.setIssuer(LocalHost.getID());
			await change.execute();
			changeDescriptors.push(change.descriptor);
		}
		const versionStatement = new VersionStatement(
			LocalHost.getID(),
			{
				prev: prevState,
				changes: await Chunk.fromObject(changeDescriptors)
			}
		);
		await LocalHost.signMessage(versionStatement);
		console.log(versionStatement);
		const descriptor = {
			type: 'obj',
			obj: versionStatement
		};
		if(await this.localCopy.hasElement('version')) {
			await this.localCopy.updateElement('version', descriptor);
		} else {
			await this.localCopy.createElement('version', descriptor);
		}
		this.currentVersion = await this.localCopy.getState();
	}

	createElement(name, descriptor) {
		return new Change('createElement', ...arguments)
			.setAction(async () => {
				await this.localCopy.createElement(name, descriptor);
			})
			.setMergePolicy(async () => {
				if(await this.hasElement(name)) {
					logger.log('info', 'createElement merge policy: element already exists, skipping');
					return false;
				}
				return true;
			})
	}

	deleteElement(name) {
		return new Change('deleteElement', ...arguments)
			.setAction(async () => {
				await this.localCopy.deleteElement(name);
			})
			.setMergePolicy(async () => {
				if(await this.hasElement(name) === false) {
					logger.log('info', 'deleteElement merge policy: element does not exist, skipping');
					return false;
				}
				return true;
			})
	}

};
