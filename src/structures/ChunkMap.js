// 2023 Adan Kvitschal <adan@moduhub.com>

import { ChunkTree } from "./ChunkTree";
import { TreeContainer } from "./TreeContainer";
import { TreeBranch } from "./TreeBranch";
import { Chunk } from '../chunking/Chunk';
import { Utils } from "../basic/Utils";


export class ChunkMap extends ChunkTree {
    
    constructor(degree) {
        super(degree);
    }

    static async fromDescriptor(descriptor) {
        if(descriptor instanceof Chunk) {
			descriptor = await descriptor.expand(1);
		}
        const newChunkMap = new ChunkMap;
        newChunkMap.descriptor = descriptor;
        return newChunkMap;
    }

    set descriptor(descriptor) {
        console.log("setting map descriptor: " + JSON.stringify(descriptor));
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
            if(descriptor.root instanceof Chunk === false) {
                throw Error("Descriptor contains an invalid root: " + JSON.stringify(descriptor.root));
            }
            this.rootChunk = descriptor.root;
        }
    }

	get descriptor() {
		return {
            type: 'map',
            degree: this.degree,
            root: this.rootChunk
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
            this.rootChunk = Chunk.fromIdentifier(newRootIdentifier);
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
                    return Chunk.fromIdentifier(valueIdentifier, this.rootChunk.ownerID);
                }
                const containerChunk = Chunk.fromIdentifier(nextContainerIdentifier, this.rootChunk.ownerID);
                iContainer = await TreeContainer.fromDescriptor(containerChunk);
            }
        }
        return undefined;
    }

    async* [Symbol.asyncIterator]() {
		if(this.rootChunk) {
			var rootContainer = await TreeContainer.fromDescriptor(this.rootChunk);
   			for await(const [keyIdentifier, valueIdentifier] of rootContainer.iterator(this.rootChunk.ownerID)) {
                const key = Chunk.fromIdentifier(keyIdentifier);
                const value = Chunk.fromIdentifier(valueIdentifier);
                yield [key, value];
            }
		}
	}
}