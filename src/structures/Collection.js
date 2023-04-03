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

export const gTypeMap = new Map;

export class Collection {

    constructor(uuid) {
		if(!uuid) {
			throw Error('Collection UUID must be informed');
		}
		if(!Utils.isUUID(uuid)) {
			throw Error('invalid UUID');
		}
		/**
         * The versioned Collection UUID helps to uniquely identify the data collection,
		 * avoiding conflicts in early commits/pull between similar collections. It is also
		 * used to store the latest data state as NVD in the local host.
         * @type {string}
         * @private
         */		
		this.uuid = uuid;
		/**
         * A map of elements under version control, the key is a chunk that expands to an
		 * object with a name property identifying the elements and the value is a descriptor chunk
         * @type {ChunkMap}
         * @private
         */
		this.elements = new ChunkMap(5);        
    }

	static registerType(typeName, type) {
		gTypeMap.set(typeName, type);
	}

    async init() {
		if(NVD.available() === false) {
			throw Error('NVD was not initialized');
		}
		const descriptor = await NVD.load(this.uuid);
		if(descriptor) {
            this.elements.descriptor = descriptor;
        }
	}

	async createElement(name, descriptor) {
        if(gTypeMap.has(descriptor.type) === false) {
            throw Error('unsupported element type');
        }
        const nameChunk = await Chunk.fromObject({name: name});
        const descriptorChunk = await Chunk.fromObject(descriptor);
        await this.elements.set(nameChunk, descriptorChunk);
		await NVD.save(this.uuid, this.elements.descriptor);
	}

	async deleteElement(name) {
        const nameChunk = await Chunk.fromObject({name: name});
        await this.elements.delete(nameChunk);
		await NVD.save(this.uuid, this.elements.descriptor);
	}

	async updateElement(name, descriptor) {
        if(gTypeMap.has(descriptor.type) === false) {
            throw Error('unsupported element type');
        }
		const nameChunk = await Chunk.fromObject({name: name});
		if(await this.elements.has(nameChunk) === false) {
			throw Error('attempt to update element that does not exist: ' + name);
		}
		const descriptorChunk = await Chunk.fromObject(descriptor);
		await this.elements.set(nameChunk, descriptorChunk);
        await NVD.save(this.uuid, this.elements.descriptor);
	}

	static async expandDescriptor(descriptorChunk) {
		const descriptor = await descriptorChunk.expand(1);
		const type = gTypeMap.get(descriptor.type);
		if(type == null
		|| type == undefined) {
			throw Error('element type not registered');
		}
		return type.fromDescriptor(descriptor);
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