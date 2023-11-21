/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Chunk } from "../chunking/Chunk.js";
import { ChunkMap } from "./ChunkMap.js";
import { NVD } from "../basic/NVD.js";
import { Utils } from "../basic/Utils.js";
import { EventEmitter } from '../basic/EventEmitter.js';
import { HostIdentifier } from "../env/HostIdentifier.js";

export const gTypeMap = new Map;

const gListeners = new Map;
const gLocalCollections = new Map;
const gPublicCollections = new Map;
const gRemoteCollections = new Map;
const gCollectionsByHost = new Map;
const gCollectionsByUUID = new Map;

export class Collection {

	/**
	 * Collection class default constructor
	 * @param {string} uuid Assign an UUID to the collection. If it is not defined,
	 * the collection will be treated as temporary and will not be stored in the local host
	 * nor be available for remote hosts.
	 * @param {string} owner Assign an owner to the collection to treat it as a remote collection
	 * or leave it undefined or equal to a string 'local' to treat it as a local collection.
	 */
    constructor(uuid, owner='local') {
		if(uuid) {
			if(!Utils.isUUID(uuid)) {
				throw Error('invalid UUID');
			}
			/**
			 * The versioned Collection UUID helps to uniquely identify the data collection.
			 * It is also used to persist the state as NVD in the local host between runs.
			 * An undefined UUID means the collection is temporary and won't be persisted.
			 * @type {string}
			 * @private
			 */
			this.uuid = uuid;
		}
		if(!owner) {
			throw Error('Collection owner must be informed');
		}
		if(owner !== 'local') {
			if(HostIdentifier.isValid(owner) === false) {
				throw Error('invalid owner');
			}
			this.owner = owner;
		}
		/**
         * A map of elements under version control, the key is a chunk that expands to an
		 * object with a name property identifying the elements and the value is a descriptor chunk
         * @type {ChunkMap}
         * @private
         */
		this.elements = new ChunkMap(5, undefined, owner);
		this.events = new EventEmitter;
    }

	static registerType(typeName, type) {
		gTypeMap.set(typeName, type);
	}

	static track(uuid, callback) {
		if(!uuid) {
			throw Error('Collection UUID must be informed');
		}
		if(!Utils.isUUID(uuid)) {
			throw Error('invalid UUID');
		}
		if(callback instanceof Function === false) {
			throw Error('invalid callback');
		}
		if(!gListeners.has(uuid)) {
			gListeners.set(uuid, new Set());
		}
		gListeners.get(uuid).add(callback);
	}

	static async getRemoteCollection(hostIdentifier, uuid) {
		// if(hostIdentifier === 'local'
		// || hostIdentifier === LocalHost.getID()) {
		// 	throw Error('attempt to fetch local collection as remote');
		// }
		if(!uuid
		|| !Utils.isUUID(uuid)) {
			throw Error('getRemoteCollection invalid UUID');
		}
		if(!HostIdentifier.isValid(hostIdentifier)) {
			throw Error('getRemoteCollection invalid hostIdentifier');
		}
		let collection = gRemoteCollections.get(hostIdentifier + ':' + uuid);
		if(!collection) {
			collection = new Collection(uuid, hostIdentifier);
			await collection.loadPersistentState();
			gRemoteCollections.set(collection.gid, collection);
			if(!gCollectionsByHost.has(hostIdentifier)) {
				gCollectionsByHost.set(hostIdentifier, new Map());
			}
			gCollectionsByHost.get(hostIdentifier).set(uuid, collection);
			if(!gCollectionsByUUID.has(uuid)) {
				gCollectionsByUUID.set(uuid, new Map());
			}
			gCollectionsByUUID.get(uuid).set(hostIdentifier, collection);
		}
		return collection;
	}

	static async getLocalCollection(uuid) {
		if(!uuid
		|| !Utils.isUUID(uuid)) {
			throw Error('getLocalCollection invalid UUID');
		}
		let collection = gLocalCollections.get(uuid);
		if(!collection) {
			collection = new Collection(uuid);
			await collection.loadPersistentState();
			gLocalCollections.set(uuid, collection);
		}
		return collection;
	}

	static async getLocalCollectionsStates() {
		if(gPublicCollections.size === 0) {
			return undefined;
		}
		const states = {};
		for(const [uuid, collection] of gPublicCollections) {
			states[uuid] = await collection.getState();
		}
		return states;
	}

	static getHostCollections(hostIdentifier) {
		return gCollectionsByHost.get(hostIdentifier);
	}

	static getCollectionsByUUID(uuid) {
		return gCollectionsByUUID.get(uuid);
	}

	static async updateRemoteCollection(hostIdentifier, uuid, state, source) {
		let collection = gRemoteCollections.get(hostIdentifier + ':' + uuid);
		if(!collection) {
			if(!gListeners.has(uuid)) {
				return;
			}
			collection = await Collection.getRemoteCollection(hostIdentifier, uuid);
		}
		const prevState = await collection.getState();
		if(prevState !== state
		|| collection.justLoaded) {
			collection.justLoaded = false;
			await collection.setState(state);
			if(collection.uuid) {
				const stateChunk = Chunk.fromIdentifier(state, source?source:hostIdentifier);
				await stateChunk.clone();
				await NVD.save(collection.gid, state);
			}
			collection.events.emit('change');
			//TODO: how to trigger specific create/delete events ??
			const listeners = gListeners.get(uuid);
			if(listeners) {
				for(const callback of listeners) {
					callback(collection);
				}
			}
		}
	}

	get gid() {
		if(!this.uuid) {
			return 'tempCollection';
		}
		if(this.owner) {
			return this.owner + ':' + this.uuid;
		} else {
			return 'local:' + this.uuid;
		}
	}

	publish() {
		if(!this.uuid
		|| Utils.isUUID(this.uuid) === false) {
			throw Error('attempt to publish a collection without a valid UUID');
		}
		if(this.owner) {
			throw Error('cannot publish a remote collection');
		}
		if(!this.uuid) {
			throw Error('cannot publish a temporary collection');
		}
		if(!gLocalCollections.has(this.uuid)) {
			throw Error('cannot publish a collection, improperly initilized, use getLocalCollection()');
		}
		gPublicCollections.set(this.uuid, this);
	}

	async getState() {
		const stateChunk = await Chunk.fromObject(this.elements.descriptor);
		return stateChunk.id;
	}

	async setState(state) {
		const stateChunk = Chunk.fromIdentifier(state, this.owner);
		const descriptor = await stateChunk.expand(0);
		this.elements.descriptor = descriptor;
	}

    async loadPersistentState() {
		if(NVD.available() === false) {
			throw Error('NVD was not initialized');
		}
		const state = await NVD.load(this.gid);
		if(state) {
            await this.setState(state);
        }
		this.justLoaded = true;
	}

	/**
	 * Enter staging mode, all changes will be staged until wrapUpStaging()
	 * or abortStaging() is called. During staging, no events are generated
	 * and no changes are saved to NVD, but any call to getElement or an
	 * iterator will include the staged changes.
	 */
	async startStaging() {
		if(this.staging) {
			throw Error('Duplicate staging mode');
		}
		this.pendingEvents = [];
		this.numStagedChanges = 0;
		this.staging = true;
		this.initialState = await this.getState();
		return this.initialState;
	}

	/**
	 * Abort staging mode, all staged changes are discarded.
	 */
	async abortStaging() {
		const initialState = this.initialState
		await this.setState(this.initialState);
		this.pendingEvents = undefined;
		this.numStagedChanges = undefined;
		this.staging = false;
		this.initialState = undefined;
		return initialState;
	}

	/**
	 * Wrap up staging mode, all staged changes are applied and saved to NVD, and all pending
	 * events are fired at once in the order they were generated.
	 * @returns {Promise} a promise that resolves to the current state of the collection.
	 */
	async wrapUpStaging() {
		const currentState = await this.getState();
		if(this.numStagedChanges > 0
		|| this.initialState != currentState) {
			for(const event of this.pendingEvents) {
				this.events.emit(...event);
			}
			if(this.uuid) {
				await NVD.save(this.gid, currentState);
			}
		}
		this.pendingEvents = undefined;
		this.numStagedChanges = undefined;
		this.staging = false;
		this.initialState = undefined;
		return currentState;
	}

	async createElement(name, descriptor) {
		if(!descriptor) {
			throw Error('descriptor must be informed');
		}
		if(descriptor.type !== 'obj') {
			if(gTypeMap.has(descriptor.type) === false) {
				throw Error('unsupported element type');
			}
		}
        const nameChunk = await Chunk.fromObject({name: name});
        const descriptorChunk = await Chunk.fromObject(descriptor);
		if(await this.elements.has(nameChunk)) {
			throw Error('createElement failed: element already exists');
		}
        await this.elements.set(nameChunk, descriptorChunk);
		const expandedElement = await Collection.expandDescriptor(descriptor);
		if(this.staging) {
			this.pendingEvents.push(['elementCreated', name]);
			this.pendingEvents.push([name + '.created', expandedElement]);
			this.pendingEvents.push(['change']);
			this.numStagedChanges++;
		} else {
			if(this.uuid) {
				await NVD.save(this.gid, await this.getState());
			}
			this.events.emit('elementCreated', name);
			this.events.emit(name + '.created', expandedElement);
			this.events.emit('change');
		}
		return expandedElement;
	}

	async deleteElement(name) {
        const nameChunk = await Chunk.fromObject({name: name});
		if(await this.elements.has(nameChunk) === false) {
			throw Error('deleteElement failed: element does not exist');
		}
        await this.elements.delete(nameChunk);
		if(this.staging) {
			this.pendingEvents.push(['elementDeleted', name]);
			this.pendingEvents.push(['change']);
			this.numStagedChanges++;
		} else {
			if(this.uuid) {
				await NVD.save(this.gid, await this.getState());
			}
			this.events.emit('elementDeleted', name);
			this.events.emit('change');
		}
	}

	async updateElement(name, descriptor) {
		if(descriptor.type !== 'obj') {
			if(gTypeMap.has(descriptor.type) === false) {
				throw Error('unsupported element type');
			}
		}
		const nameChunk = await Chunk.fromObject({name: name});
		if(await this.elements.has(nameChunk) === false) {
			throw Error('attempt to update element that does not exist: ' + name);
		}
		const descriptorChunk = await Chunk.fromObject(descriptor);
		await this.elements.set(nameChunk, descriptorChunk);
		const elementInstance = await Collection.expandDescriptor(descriptor);
		if(this.staging) {
			this.pendingEvents.push(['elementUpdated', name]);
			this.pendingEvents.push([name + '.change', elementInstance]);
			this.pendingEvents.push(['change']);
			this.numStagedChanges++;
		} else {
			if(this.uuid) {
				await NVD.save(this.gid, await this.getState());
			}
			this.events.emit('elementUpdated', name);
			this.events.emit(name + '.change', elementInstance);
			this.events.emit('change');
		}
		return elementInstance;
	}

	static async expandDescriptor(descriptor) {
		if(descriptor instanceof Chunk) {
			descriptor = await descriptor.expand(0);
		}
		if(descriptor.type === 'obj') {
			return descriptor.obj;
		} else {
			const type = gTypeMap.get(descriptor.type);
			if(type == null
			|| type == undefined) {
				throw Error('element type not registered');
			}
			return type.fromDescriptor(descriptor);
		}
	}

	/**
	 * Retrieves from the the collection the element identified by the given name.
	 * The element type must be registered previously using the registerType method.
	 * @param {string} name name identifier of the object to be retrived
	 * @return the element as an instance of the class assigned to its descriptor
	 */
	async getElement(name) {
		const nameChunk = await Chunk.fromObject({name: name});
		const descriptorChunk = await this.elements.get(nameChunk);
		if(descriptorChunk) {
			const element = Collection.expandDescriptor(descriptorChunk);
			element.ownerID = this.owner;
			return element;
		}
		return undefined;
	}

	async hasElement(name) {
		const nameChunk = await Chunk.fromObject({name: name});
		return await this.elements.has(nameChunk);
	}

	/**
	 * Iterates collection elements and returns their names and
	 * type expanded values
	 */
	async* [Symbol.asyncIterator]() {
		for await (const [keyChunk, valueChunk] of this.elements) {
			const nameObject = await keyChunk.expand();
			yield [nameObject.name, await Collection.expandDescriptor(valueChunk)];
		}
	}

	async toArray() {
		const array = [];
		for await(const [keyChunk, valueChunk] of this.elements) {
			const nameObject = await keyChunk.expand();
			const descriptor = await valueChunk.expand(0);
			array.push({name: nameObject.name, descriptor});
		}
		return array;
	}

}