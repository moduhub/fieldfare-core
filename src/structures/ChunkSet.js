/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { ChunkTree } from "./ChunkTree.js";
import { Chunk } from  "../chunking/Chunk.js";
import { TreeContainer } from "./TreeContainer.js";
import { TreeBranch } from "./TreeBranch.js";
import { Utils } from "../basic/Utils.js";

export class ChunkSet extends ChunkTree {

    constructor(degree, root, owner) {
        super(degree, root, owner);
    }

    static async fromDescriptor(descriptor) {
        if(descriptor instanceof Chunk) {
			descriptor = await descriptor.expand(1);
		}
        const newChunkSet = new ChunkSet;
        newChunkSet.descriptor = descriptor;
        return newChunkSet;
    }

    set descriptor(descriptor) {
        Utils.validateParameters(descriptor, ['type', 'degree'], ['root']);
        if(descriptor.type !== 'set') {
            throw Error('Unexpected type value');
        }
        this.degree = descriptor.degree;
        if(descriptor.root) {
            this.rootChunk = Chunk.fromIdentifier(descriptor.root, this.owner);
        } else {
            this.rootChunk = undefined;
        }
    }

	get descriptor() {
		return {
            type: 'set',
            degree: this.degree,
            root: this.rootChunk?.id
        };
	}

	async add(element) {
        if(!this.local) {
            throw Error('Attempt to edit a remote chunk set');
        }
        if(element instanceof Chunk === false) {
            throw Error('inserting an element that is not a chunk');
        }
		if(this.rootChunk === null
		|| this.rootChunk === undefined) {
            var newRoot = new TreeContainer(null, false);
    		newRoot.add(element.id);
    		this.rootChunk = await Chunk.fromObject(newRoot);
		} else {
            const branch = new TreeBranch(this.rootChunk.id, this.owner);
            await branch.getToKey(element.id);
            var iContainer = branch.getLastContainer();
            if(branch.containsKey) {
                throw Error('attempt to add a duplicate element');
            }
   			iContainer.add(element.id);
            const maxElements = this.degree;
            var newRootIdentifier;
            if(iContainer.numElements === maxElements) {
                const splitDepth = await branch.split(maxElements);
                newRootIdentifier = await branch.update(splitDepth);    //update only from split down to root
            } else {
                newRootIdentifier = await branch.update();
            }
            this.rootChunk = Chunk.fromIdentifier(newRootIdentifier, this.owner);
		}
		return this.rootChunk;
	}

    async* chunks() {
        if(this.rootChunk) {
			var rootContainer = await TreeContainer.fromDescriptor(this.rootChunk);
            for await(const identifier of rootContainer.iterator(this.rootChunk.ownerID)) {
                yield Chunk.fromIdentifier(identifier, this.owner);
            }
		}
    }

    async* [Symbol.asyncIterator]() {
        yield* this.chunks();
	}

    async toArray() {
        const array = [];
        for await (const chunk of this.chunks()) {
            array.push(chunk);
        }
        return array;
    }

}