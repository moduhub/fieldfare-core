// 2023 Adan Kvitschal <adan@moduhub.com>

import { ChunkTree } from "./ChunkTree";
import { Chunk } from  "../chunking/Chunk";
import { TreeContainer } from "./TreeContainer";
import { TreeBranch } from "./TreeBranch";
import { Utils } from "../basic/Utils";

export class ChunkSet extends ChunkTree {

    constructor(degree) {
        super(degree);
    }

    static async fromDescriptor(descriptor) {
        if(descriptor instanceof Chunk) {
			descriptor = await descriptor.expand();
		}
        const newChunkSet = new ChunkSet;
        newChunkSet.descriptor = descriptor;
        return newChunkSet;
    }

    set descriptor(descriptor) {
        Utils.validateParameters(descriptor, ['type', 'degree'], ['root']);
        const degree = descriptor.degree;
        if(descriptor.type !== 'set') {
            throw Error('Unexpected type value');
        }
        this.degree = descriptor.degree;
        if(descriptor.root) {
            if(descriptor.root instanceof Chunk === false) {
                throw Error("Descripto contains an invalid root");
            }
            this.root = descriptor.root;
        }
    }

	get descriptor() {
		return {
            type: 'set',
            degree: this.degree,
            root: this.rootChunk
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
            const branch = new TreeBranch(this.rootChunk.id, this.rootChunk.ownerID);
            await branch.getToKey(element.id);
            var iContainer = branch.getLastContainer();
            if(branch.containsKey) {
                throw Error('attempt to add a duplicate and element');
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
            this.rootChunk = Chunk.fromIdentifier(newRootIdentifier, this.ownerID);
		}
		return this.rootChunk;
	}

    async* [Symbol.asyncIterator]() {
		if(this.rootChunk) {
			var rootContainer = await TreeContainer.fromDescriptor(this.rootChunk);
            for await(const identifier of rootContainer.iterator(this.rootChunk.ownerID)) {
                yield Chunk.fromIdentifier(identifier);;
            }
		}
	}

}