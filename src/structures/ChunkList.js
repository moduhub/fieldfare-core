// 2023 Adan Kvitschal <adan@moduhub.com>

import { Chunk } from '../chunking/Chunk'
import { Utils } from '../basic/Utils';
import { logger } from '../basic/Log';

/**
 * Stores chunks as a list, appending data always in the end.
 * The list is organized in containers that are chunk themselves,
 * and can contain one or more chunks of data deppending on the value
 * of the 'degree' property.
 */
export class ChunkList {

	constructor(degree, last, ownerID) {
		if(degree == undefined
		|| degree == null) {
			degree = 1;
		} else {
			if(Number.isInteger(degree) === false
			|| degree < 1
			|| degree > 10) {
				throw Error('Invalid list degree value');
			}
		}
		/**
         * Defines how many chunks are stored per container, must be 
		 * an integer greater than zero.
         * @type {integer}
         * @private
         */
		this.degree = degree;
		if(last) {
			if(last instanceof Chunk === false) {
				throw Error('list pointer to last is not a valid chunk');
			}
		}
		/**
         * Chunk that contains the last container in the list
         * @type {Chunk}
         * @private
         */
		this.last = last;
		if(ownerID) {
			this.local = false;
			this.ownerID = ownerID;
		} else {
			this.local=true;
		}
	}

	static async fromDescriptor(descriptor) {
		if(descriptor instanceof Chunk) {
			descriptor = await descriptor.expand();
		}
		const newChunkList = new ChunkList();
		newChunkList.descriptor = descriptor;
		return newChunkList;
	}

    set descriptor(descriptor) {
		Utils.validateParameters(descriptor, ['type', 'degree'], ['last', 'ownerID']);
		if(descriptor.type !== 'list') {
			throw Error('Descriptor type is not compatible with chunk list');
		}
		if(descriptor.last) {
			if(descriptor.last instanceof Chunk === false) {
				throw Error('List descriptor does not contain a valid container pointer');
			}
			this.last = descriptor.last;
		}
		if(descriptor.owner) {
			if(descriptor.owner instanceof Chunk === false) {
				throw Error('list descriptor does not contain a valid owner identifier');
			}
		}
		this.degree = descriptor.degree;
    }

	get descriptor() {
		return {
            type: 'set',
            degree: this.last,
            root: this.rootChunk
        };
	}

	async getNumElements() {
		if(this.numElements == undefined) {
			if(this.last) {
				const lastContainer = await this.last.expand();
				this.numElements = lastContainer.index + lastContainer.content.length;
			} else {
				this.numElements = 0;
			}
		}
		return this.numElements;
	}

	clear() {
		this.last = Chunk.null();
		this.numElements = 0;
	}

	/**
	 * Verify is a chunk is present in the list. A single ocurrence of
	 * the chunk in the list will cause this method to return true.
	 * @param {Chunk} element chunk to be found inside the list
	 * @returns true if the element is located, false otherwise
	 */
	async has(element) {
		if(element instanceof Chunk === false) {
			throw Error('element not an instance of Chunk');
		}
		var iContainer = this.last.expand();
		while(iContainer) {
			if(this.degree == 1) {
				if(iContainer instanceof Chunk === false) {
					throw Error('Received a non-chunk element inside a list');
				}
				if(iContainer.content.id === element.id) {
					return true;
				}
			} else {
				if(iContainer instanceof Array === false) {
					throw Error('list element content must be an array if degree > 1');
				}
				for(const entry of iContainer.content) {
					if(entry instanceof Chunk === false) {
						throw Error('Received a non-chunk element inside a list');
					}
					if(entry.id === element.id) {
						return true;
					}
				}
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
		var newContainer;
		if(this.degree == 1) {
			newContainer = {
				prev: this.last,
				index: currentNumElements,
				content: element
			};
		} else {
			if(this.last) {
				const oldContainer = await this.last.expand();
				//check if element must go into the last
				if(oldContainer.content.length == this.degree) {
					newContainer = {
						prev: this.last,
						index: currentNumElements,
						content: [element]
					};
				} else {
					oldContainer.content.push(element);
					newContainer = oldContainer;
				}
			} else {
				newContainer = {
					prev: '',
					index: 0,
					content: [element]
				};
			}
		}
		this.last = await Chunk.fromObject(newContainer);
		this.numElements++;
		//logger.debug("[HLL append] newListElement: " + JSON.stringify(newListElement));
	}

	async* [Symbol.asyncIterator]() {
		if(this.last) {
			var iContainer = await this.last.expand(1);
			while(iContainer) {
				const content = iContainer.content;
				if(content instanceof Array) {
					var i = content.length-1;
					while(i>=0) {
						const chunk = content[i--];
						if(chunk instanceof Chunk === false) {
							throw Error('Expected a Chunk in list contents, but got ' + chunk.constructor.name);
							//throw Error('Received an invalid chunk inside an array while iterating a ChunkList: ' + JSON.stringify(chunk));
						}
						yield chunk;
					}
				} else {
					if(content instanceof Chunk === false) {
						throw Error('Expected a Chunk in list contents, but got ' + content.constructor.name);
						//throw Error('Received an invalid chunk while iterating a ChunkList: ' + JSON.stringify(content));
					}
					yield content;
				}
				if(!iContainer.prev) {
					break;
				}
				iContainer = await iContainer.prev.expand(1);
			}
		}
	}

}
