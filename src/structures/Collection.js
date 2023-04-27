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
			 * An undefined UUID memans the collection is temporary and won't be persisted.
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
		this.elements = new ChunkMap(5, undefined, (!owner || owner=='local')? true: false);
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

	static getRemoteCollection(hostIdentifier, uuid) {
		return gRemoteCollections.get(hostIdentifier + ':' + uuid);
	}

	static getLocalCollections() {
		return gLocalCollections;
	}

	static async getLocalCollectionsStates() {
		if(gLocalCollections.size === 0) {
			return undefined;
		}
		const states = {};
		for(const [uuid, collection] of gLocalCollections) {
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

	static async updateRemoteCollection(hostIdentifier, uuid, state) {
		if(gListeners.has(uuid)) {
			let collection = gRemoteCollections.get(hostIdentifier + ':' + uuid);
			if(!collection) {
				collection = new Collection(uuid, hostIdentifier);
				await collection.loadPersistentState();
				gRemoteCollections.set(this.gid, this);
				if(!gCollectionsByHost.has(hostIdentifier)) {
					gCollectionsByHost.set(hostIdentifier, new Map());
				}
				gCollectionsByHost.get(hostIdentifier).set(uuid, this);
				if(!gCollectionsByUUID.has(uuid)) {
					gCollectionsByUUID.set(uuid, new Map());
				}
				gCollectionsByUUID.get(uuid).set(hostIdentifier, this);
			}
			const prevState = await collection.getState();
			if(prevState != state) {
				await collection.setState(state);
				collection.events.emit('change');
				//TODO: how to trigger specific create/delete events ??
				for(const callback of gListeners.get(uuid)) {
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
		if(this.owner) {
			throw Error('cannot publish a remote collection');
		}
		if(!this.uuid) {
			throw Error('cannot publish a temporary collection');
		}
		gLocalCollections.set(this.uuid, this);
	}

	async getState() {
		const stateChunk = await Chunk.fromObject(this.elements.descriptor);
		return stateChunk.id;
	}

	async setState(state) {
		const stateChunk = Chunk.fromIdentifier(state, this.owner);
		const descriptor = await stateChunk.expand(0);
		console.log('setState', descriptor);
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
		if(this.uuid) {
			await NVD.save(this.gid, await this.getState());
		}
		const expandedElement = await Collection.expandDescriptor(descriptor);
		this.events.emit('elementCreated', name);
		this.events.emit(name + '.created', expandedElement);
		this.events.emit('change');
		return expandedElement;
	}

	async deleteElement(name) {
        const nameChunk = await Chunk.fromObject({name: name});
		if(await this.elements.has(nameChunk) === false) {
			throw Error('deleteElement failed: element does not exist');
		}
        await this.elements.delete(nameChunk);
		if(this.uuid) {
			await NVD.save(this.gid, await this.getState());
		}
		this.events.emit('elementDeleted', name);
		this.events.emit('change');
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
		if(this.uuid) {
        	await NVD.save(this.gid, await this.getState());
		}
		this.events.emit('elementUpdated', name);
		this.events.emit(name + '.change', Collection.expandDescriptor(descriptor));
		this.events.emit('change');
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
			return Collection.expandDescriptor(descriptorChunk);
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

}