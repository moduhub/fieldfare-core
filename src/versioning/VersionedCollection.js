// 2023 Adan Kvitschal <adan@moduhub.com>

import { LocalHost } from '../env/LocalHost';
import { Chunk } from '../chunking/Chunk';
import { ChunkingUtils } from '../chunking/ChunkingUtils';
import { ChunkMap } from '../structures/ChunkMap';
import { VersionStatement } from './VersionStatement';
import { VersionChain } from './VersionChain';
import { NVD } from '../basic/NVD';
import { Utils } from '../basic/Utils';
import { logger } from '../basic/Log';
const util = require('node:util');

const gTypeMap = new Map;

/**
 * Represents a group of elements that can be altered
 * by a group of hosts in a collaborative manner. Any changes made to
 * the data must be commited by creating VersionStatements and sharing
 * them with all other hosts in the admin group, that may accept or
 * reject the changes based on a shared set of rules.
 */
export class VersionedCollection {

	constructor() {
		/**
         * A map of elements under version control, the key is a chunk that expands to an
		 * object with a name property identifying the elements and the value is a descriptor chunk
         * @type {ChunkMap}
         * @private
         */
		this.elements = new ChunkMap(5);
		/**
         * List of methods that can alter the contents of the elements under version control
         * @type {Map}
         * @private
         */
		this.methods = new Map();

		this.methods.set('createElement', this.applyCreateElement.bind(this));
		//this.methods.set('deleteElement', this.applyDeleteElement.bind(this));
		this.versionIdentifier = '';
		this.versionBlacklist = new Set();
	}

	static registerType(typeName, type) {
		gTypeMap.set(typeName, type);
	}

	async applyChain(chain, merge=false) {
		//just accept remote changes
		const changes = await chain.getChanges();
		logger.log('info', "applyChain: changes:" + JSON.stringify(changes));
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

	async pull(versionChunk) {
		const versionIdentifier = versionChunk.id;
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
		const versionStatement = await VersionStatement.fromDescritor(versionChunk);
		logger.debug("Received version statement: " + JSON.stringify(versionStatement,null, 2));
		const localChain = new VersionChain(this.versionIdentifier, LocalHost.getID(), 50);
		const remoteChain = new VersionChain(versionIdentifier, owner, 50);
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
				await this.applyChain(remoteChain);
				const newElementsChunk = await Chunk.fromObject(this.elements.descriptor);
				const expectedState = await remoteChain.getHeadState();
				// logger.log('info', "state after apply: " + stateKey);
				// logger.log('info', "expected state: " + expectedState);
				if(newElementsChunk.id !== expectedState) {
					throw Error('state mismatch after remote changes applied');
				}
				this.versionIdentifier = remoteChain.head;
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
				await NVD.save(this.uuid, this.versionIdentifier);
				// Reset blacklist
				this.versionBlacklist.clear();
				logger.debug('Environment ' + this.uuid + ' updated successfully to version ' + this.versionIdentifier);
			} catch (error) {
				// Recover previous state
				await this.checkout(localChain.head);
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
		versionStatement.data = {
			prev: this.versionIdentifier,
			elements: await Chunk.fromObject(this.elements.descriptor),
			changes: await Chunk.fromObject(changes)
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
		if(gTypeMap.has(descriptor.type) === false) {
			throw Error('element type not registered');
		}
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

	/**
	 * Retrieves from the current version of the collection the element identified
	 * by the given name.
	 * The element type must be registered previously using the registerType method.
	 * @param {string} name name identifier of the object to be retrived
	 * @param {string} version version of the collection from which the object will
	 * be retrieved, defaults to lastest.
	 * @return the element as an instance of the class given by its descriptor
	 */
	async getElement(name) {
		const nameChunk = await Chunk.fromObject({name: name});
		const descriptorChunk = await this.elements.get(nameChunk);
		if(descriptorChunk) {
			const descriptor = await descriptorChunk.expand(1);
			const type = gTypeMap.get(descriptor.type);
			if(type == null
			|| type == undefined) {
				throw Error('element type not registered');
			}
			return type.fromDescriptor(descriptor);
		}
		return undefined;
	}

	async updateElement(name, descriptor) {
		const nameChunk = await Chunk.fromObject({name: name});
		if(await this.elements.has(nameChunk) === false) {
			throw Error('attempt to update element that does not exist: ' + name);
		}
		const descriptorChunk = await Chunk.fromObject(descriptor);
		await this.elements.set(nameChunk, descriptorChunk);
	}

};
