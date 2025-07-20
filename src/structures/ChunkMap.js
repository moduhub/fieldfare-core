/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { ChunkTree } from "./ChunkTree.js";
import { TreeContainer } from "./TreeContainer.js";
import { TreeBranch } from "./TreeBranch.js";
import { Chunk } from '../chunking/Chunk.js';
import { Utils } from "../basic/Utils.js";

export class ChunkMap extends ChunkTree {
    
    constructor(degree, root, owner) {
        super(degree, root, owner);
    }

    static async fromDescriptor(descriptor) {
        if(descriptor instanceof Chunk) {
			descriptor = await descriptor.expand(0);
		}
        const newChunkMap = new ChunkMap;
        newChunkMap.descriptor = descriptor;
        return newChunkMap;
    }

    set descriptor(descriptor) {
        if(!descriptor) {
            return;
        }
        Utils.validateParameters(descriptor, ['type', 'degree'], ['root']);
        if(descriptor.type !== 'map') {
            throw Error('Unexpected type value');
        }
        if(Number.isInteger(descriptor.degree) === false
        || descriptor.degree < 2
        || descriptor.degree > 10) {
            throw Error('invalid map tree degree: ' + descriptor.degree);
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
            type: 'map',
            degree: this.degree,
            root: this.rootChunk?.id
        };
	}

    async set(key, value) {
        if(this.readOny) {
            throw Error('Attempt to edit a read only chunk set');
        }
        if(key instanceof Chunk === false) {
            throw Error('inserting a key element that is not a chunk');
        }
        if(value instanceof Chunk === false) {
            throw Error('inserting a value element that is not a chunk');
        }
		if(this.rootChunk === null
		|| this.rootChunk === undefined) {
            var newRoot = new TreeContainer(null, true);
    		newRoot.add([key.id, value.id]);
    		this.rootChunk = await Chunk.fromObject(newRoot);
		} else {
            const branch = new TreeBranch(this.rootChunk.id, this.rootChunk.ownerID);
            await branch.getToKey(key.id);
            var iContainer = branch.getLastContainer();
            var newRootIdentifier;
            if(branch.containsKey) {
                iContainer.updateKeyValue(key.id, value.id);
                newRootIdentifier = await branch.update();
            } else {
                iContainer.add([key.id, value.id]);
                const maxElements = this.degree;
                if(iContainer.numElements === maxElements) {
                    const splitDepth = await branch.split(maxElements);
                    newRootIdentifier = await branch.update(splitDepth);    //update only from split down to root
                } else {
                    newRootIdentifier = await branch.update();
                }
            }
            this.rootChunk = Chunk.fromIdentifier(newRootIdentifier, this.owner);
        }
    }

    async get(key) {
        if(key instanceof Chunk === false) {
            throw Error('get() failed: key is not a Chunk');
        }
        if(this.rootChunk) {
            var iContainer = await TreeContainer.fromDescriptor(this.rootChunk);
            while(iContainer) {
                const nextContainerIdentifier = iContainer.follow(key.id);
                if(nextContainerIdentifier === true) {
                    const valueIdentifier = iContainer.getKeyValue(key.id);
                    return Chunk.fromIdentifier(valueIdentifier, this.owner);
                }
                const containerChunk = Chunk.fromIdentifier(nextContainerIdentifier, this.owner);
                iContainer = await TreeContainer.fromDescriptor(containerChunk);
            }
        }
        return undefined;
    }

    async* keyChunks() {
        if(this.rootChunk) {
			var rootContainer = await TreeContainer.fromDescriptor(this.rootChunk);
   			for await(const [keyIdentifier, valueIdentifier] of rootContainer.iterator(this.rootChunk.ownerID)) {
                yield Chunk.fromIdentifier(keyIdentifier, this.owner);
            }
		}
    }

    async* valueChunks() {
        if(this.rootChunk) {
			var rootContainer = await TreeContainer.fromDescriptor(this.rootChunk);
   			for await(const [keyIdentifier, valueIdentifier] of rootContainer.iterator(this.rootChunk.ownerID)) {
                yield Chunk.fromIdentifier(valueIdentifier, this.owner);
            }
		}
    }

    async* contents() {
        if(this.rootChunk) {
			var rootContainer = await TreeContainer.fromDescriptor(this.rootChunk);
   			for await(const [keyIdentifier, valueIdentifier] of rootContainer.iterator(this.rootChunk.ownerID)) {
                const key = Chunk.fromIdentifier(keyIdentifier, this.owner);
                const value = Chunk.fromIdentifier(valueIdentifier, this.owner);
                yield [key, value];
            }
		}
    }

    async* transformedContents(transform=(keyChunk, valueChunk)=>[keyChunk, valueChunk]) {
        for await (const [keyChunk, valueChunk] of this.contents()) {
            yield await transform(keyChunk, valueChunk);
        }
    }

    async* [Symbol.asyncIterator]() {
		yield* this.contents();
	}

}