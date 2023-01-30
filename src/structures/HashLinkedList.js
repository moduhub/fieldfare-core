/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.

 */

import { LocalHost } from '../env/LocalHost';
import { Chunk } from '../chunking/Chunk'
import { Utils } from '../basic/Utils';
import { logger } from '../basic/Log';


export class HashLinkedList {

	constructor(last, ownerID) {
		if(last instanceof Chunk === false) {
			throw Error('list pointer to last is not a valid chunk');
		}
		this.last = last;
		if(ownerID
		&& ownerID != LocalHost.getID()) {
			this.local = false;
			this.ownerID = ownerID;
		} else {
			this.local=true;
		}
	}

	static async create() {
		this.last = Chunk.null();
		this.local = true;
	}

	static async fromDescriptor(descriptorChunk) {
		if(descriptor instanceof Chunk === false) {
			throw Error('hash linked list descriptor is not a valid Chunk');
		}
		descriptor = await descriptorChunk.expand();
		Utils.validateParameters(descriptor, ['type', 'last', 'ownerID']);
		if(descriptor.type !== 'list') {
			throw Error('Descriptor type is not compatible with hash linked list');
		}
		if(descriptor.last instanceof Chunk === false) {
			throw Error('List descriptor does not contain a valid container pointer');
		}
		if(descriptor.owner instanceof Chunk === false) {
			throw Error('list descriptor does not contain a valid owner identifier');
		}
		return new HashLinkedList(descriptor.last, descriptor.ownerID);
	}

	toDescriptor() {
		var ownerID;
		if(this.local) {
			ownerID = LocalHost.getID();
		} else {
			ownerID = this.ownerID;
		}
		return Chunk.fromObject({
			type: 'list',
			last: this.last,
			owner: ownerID
		});
	}

	async getNumElements() {
		if(this.numElements) {
			return this.numElements;
		}
		if(this.last) {
			const lastContainer = this.last.expand();
			this.numElements = lastContainer.index;
		}
		return 0;
	}

	clear() {
		this.last = Chunk.null();
		this.numElements = 0;
	}

	async has(element) {
		if(element instanceof Chunk === false) {
			throw Error('element not an instance of Chunk');
		}
		var iContainer = this.last.expand();
		while(iContainer) {
			//logger.debug('iNodeKey: ' + iNodeKey + ' vs ' + key);
			if(iContainer.content === element) {
				return true;
			}
			iContainer = iContainer.prev.expand();
		}
		return false;
	}

	async append(element) {
		if(!this.local) {
			throw Error('Attempt to edit a remote linked list');
		}
		const currentNumElements = await this.getNumElements();
		this.last = await Chunk.fromObject({
			prev: this.last,
			index: currentNumElements,
			content: element
		});
		this.numElements++;
		//logger.debug("[HLL append] newListElement: " + JSON.stringify(newListElement));
	}

	async* [Symbol.asyncIterator]() {
		var iContainer = this.last.expand();
		while(iContainer) {
			yield iContainer.content;
			iContainer = iContainer.prev.expand();
		}
	}
};
