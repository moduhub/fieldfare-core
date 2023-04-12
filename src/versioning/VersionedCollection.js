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

	get state() {
		return this.versionIdentifier;
	}

	set state(state) {
		this.versionIdentifier = state;
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
				const change = this.getChangeFromDescriptor(changeDescriptor);
				await change.execute();
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
				const localChanges = await localChain.getChanges();
				//now merge local changes at end of remote chain, if any
				if(localCommitsAhead > 0) {
					for await (const change of localChanges) {
						await this.apply(change.issuer, change.method, change.params, true);
					}
					const descriptorChunk = await Chunk.fromObject(this.elements.descriptor);
					const stateAfterMergeKey = descriptorChunk.id;
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
				await NVD.save(this.uuid, this.versionIdentifier);
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
	}

	/**
	 * Empty implementation of the auth method allows everything
	 * @param {String} id Identifer of the host being authorized
	 * @param {boolean} strict strict option
	 */
	async auth(id, strict=false) {
		logger.debug('>> ' + id + ' auth OK');
	}

	async applyCreateElement(issuer, params, merge=false) {
		// console.log("applyCreateElement params: " + JSON.stringify(params));
		Utils.validateParameters(params, ['name', 'descriptor']);
		const descriptor = params.descriptor;
		// console.log('descriptorChunk: ' + JSON.stringify(descriptorChunk));
		// console.log('descriptor: ' + JSON.stringify(descriptor));
		if('type' in descriptor == false) {
			throw Error('missing type in element descriptor');
		}
		// if(gTypeMap.has(descriptor.type) === false) {
		// 	throw Error('element type not registered');
		// }
		const nameChunk = await Chunk.fromObject({name: params.name});
		if(await this.elements.has(nameChunk)) {
			if(merge) {
				logger.log('info', 'applyCreateElement successfully MERGED');
				return;
			} else {
				throw Error('applyCreateElement failed: name already exists');
			}
		}
		await this.auth(issuer, false);
		//Perform local changes
		const descriptorChunk = await Chunk.fromObject(descriptor);
		await this.elements.set(nameChunk, descriptorChunk);
		// console.log('info', "Current elements: ");
		// for await (const [key, value] of this.elements) {
		// 	console.log('info', '> ' + JSON.stringify(await key.expand()) + ': ' + JSON.stringify(await value.expand()));
		// }
	}

	async createElement(name, descriptor) {
		const params = {name: name, descriptor: descriptor};
		//console.log('info', "VersionedData.createElement name="+name + ", descriptor="+descriptor);
		await this.applyCreateElement(LocalHost.getID(), params);
		await this.commit({
			createElement: params
		});
		await NVD.save(this.uuid, this.versionIdentifier);
	}

	async applyDeleteElement(issuer, params, merge=false) {
		// console.log("applyDeleteElement params: " + JSON.stringify(params));
		Utils.validateParameters(params, ['name']);
		const nameChunk = await Chunk.fromObject({name: params.name});
		if(await this.elements.has(nameChunk) === false) {
			if(merge) {
				logger.log('info', 'applyDeleteElement successfully MERGED');
				return;
			} else {
				throw Error('applyDeleteElement failed: element does not exist');
			}
		}
		await this.auth(issuer, false);
		//Perform local changes
		await this.elements.delete(nameChunk);
		// console.log('info', "Current elements: ");
		// for await (const [key, value] of this.elements) {
		// 	console.log('info', '> ' + JSON.stringify(await key.expand()) + ': ' + JSON.stringify(await value.expand()));
		// }
	}

	async deleteElement(name) {
		const params = {name: name};
		//console.log('info', "VersionedData.createElement name="+name + ", descriptor="+descriptor);
		await this.applyDeleteElement(LocalHost.getID(), params);
		await this.commit({
			deleteElement: params
		});
		await NVD.save(this.uuid, this.versionIdentifier);
	}

};
