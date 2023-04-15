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
export class VersionedCollection extends Collection {

	constructor(uuid) {
		super(uuid);
		this.versionIdentifier = '';
		this.versionBlacklist = new Set();	
		/**
		 * Name of the methods that can be used to alter the collection elements 'legally'.
		 * Any remote call to a method outside this set will be blocked.
		 * @type {Set<string, CollectionMethod>}
		 */
		this.allowedChanges = new Set([
			'createElement', 'deleteElement'
		]);
	}

	async getState() {
		return this.versionIdentifier;
	}

	async setState(state) {
		await this.checkout(state);
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
	 * @param {string} versionIdentifier 
	 */
	async checkout(versionIdentifier) {
		const versionChunk = Chunk.fromIdentifier(versionIdentifier);
		const statement = await VersionStatement.fromDescriptor(versionChunk);
		const elementsChunk = statement.data.elements;
		if(elementsChunk instanceof Chunk === false) {
			throw Error('elements inside versionChunk not a valid chunk');
		}
		this.elements = await ChunkMap.fromDescriptor(elementsChunk);
		this.versionIdentifier = versionChunk.id;
	}

	/**
	 * Update to a given version, fetching changes from a given source host.
	 * @param {string} versionIdentifier 
	 * @param {HostIdentifier} source 
	 * @returns 
	 */
	async pull(versionIdentifier, source) {
		ChunkingUtils.validateIdentifier(versionIdentifier);
		if(this.updateInProgress === versionIdentifier) {
			//Already updating to same version, consider success?
			return;
		}
		if(this.updateInProgress) {
			throw Error('another update in progress');
		}
		if(this.versionBlacklist.has(versionIdentifier)) {
			throw Error('This version has been blacklisted');
		}
		logger.debug(">> pull changes to version: " + versionIdentifier);
		this.updateInProgress = versionIdentifier;
		const versionChunk = Chunk.fromIdentifier(versionIdentifier, source);
		const versionStatement = await VersionStatement.fromDescriptor(versionChunk);
		logger.debug("Received version statement: " + JSON.stringify(versionStatement,null, 2));
		const localChain = new VersionChain(this.versionIdentifier, LocalHost.getID(), 50);
		const remoteChain = new VersionChain(versionIdentifier, source, 50);
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
				logger.debug("state before apply: " + JSON.stringify(this.elements.descriptor));
				await this.applyChain(remoteChain);
				const newElementsChunk = await Chunk.fromObject(this.elements.descriptor);
				const expectedState = await remoteChain.getHeadDescriptor();
				logger.debug("state after apply: " + JSON.stringify(this.elements.descriptor));
				logger.debug("expected state: " + JSON.stringify(await expectedState.expand(1)));
				if(newElementsChunk.id !== expectedState.id) {
					throw Error('state mismatch after remote changes applied');
				}
				this.versionIdentifier = remoteChain.head;
				//now merge local changes at end of remote chain, if any
				if(localCommitsAhead > 0) {
					this.applyChain(localChain, true);
					const descriptorChunk = await Chunk.fromObject(this.elements.descriptor);
					//only commit if changes were not redundant
					if(descriptorChunk.id !== expectedState) {
						await this.commit({
							merge: {
								head: localChain.head,
								base: localChain.base}
							}
						);
					}
				}
				//Save changes permanently
				await NVD.save(this.uuid, await this.getState());
				// Reset blacklist
				this.versionBlacklist.clear();
				logger.debug('Environment ' + this.uuid + ' updated successfully to version ' + this.versionIdentifier);
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
		const changeDescriptors = [];
		for(const change of changes) {
			if(change instanceof Change === false) {
				throw Error('Invalid change');
			}
			change.setIssuer(LocalHost.getID());
			await change.execute();
			changeDescriptors.push(change.descriptor);
		}
		var versionStatement = new VersionStatement();
		versionStatement.source = LocalHost.getID();
		versionStatement.data = {
			prev: this.versionIdentifier,
			elements: await Chunk.fromObject(this.elements.descriptor),
			changes: await Chunk.fromObject(changeDescriptors)
		};
		await LocalHost.signMessage(versionStatement);
		const versionChunk = await Chunk.fromObject(versionStatement);
		this.versionIdentifier = versionChunk.id;
		logger.debug("New version statement: " + JSON.stringify(versionStatement, null, 2)//.replaceAll('\\', '')
			+ "->" + this.versionIdentifier);
		await NVD.save(this.uuid, await this.getState());
	}

	forceCreateElement(name, descriptor) {
		return super.createElement(name, descriptor);
	}

	createElement(name, descriptor) {
		return new Change('createElement', arguments)
			.setAction(async () => {
				await super.createElement(name, descriptor);
			})
			.setMergePolicy(async () => {
				if(await this.hasElement(name)) {
					logger.log('info', 'createElement merge policy: element already exists, skipping');
					return false;
				}
				return true;
			})
	}

	forceDeleteElement(name) {
		return super.deleteElement(name);
	}

	deleteElement(name) {
		return new Change('deleteElement', arguments)
			.setAction(async () => {
				await super.deleteElement(name);
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
