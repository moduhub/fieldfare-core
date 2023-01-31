import { HashLinkedTree } from "./HashLinkedTree";
import { TreeContainer } from "./TreeContainer";
import { TreeBranch } from "./TreeBranch";
import { Chunk } from '../chunking/Chunk';


export class HashLinkedMap extends HashLinkedTree {
    
    constructor(degree, root) {
        if(Number.isInteger(degree) === false
        || degree < 2
        || degree > 10) {
            throw Error('invalid map tree degree: ' + degree);
        }
        super(degree, root);
    }

    static async fromDescriptor(descriptorChunk) {
        const descriptor = await descriptorChunk.expand();
        Utils.validateParameters(descriptor, ['type', 'degree', 'root']);
        const degree = descriptor.degree;
        if(descriptor.type !== 'map') {
            throw Error('Unexpected type value');
        }
        return new HashLinkedMap(descriptor.degree, descriptor.root);
    }

	toDescriptor() {
		return Chunk.fromObject({
            type: 'map',
            degree: this.degree,
            root: this.rootChunk
        });
	}

    async set(key, value) {
        if(this.readOny) {
            throw Error('Attempt to edit a read only hash linked set');
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
            var newRootKey;
            if(branch.containsKey) {
                iContainer.updateKeyValue(key.id, value.id);
                newRootKey = await branch.update();
            } else {
                iContainer.add([key.id, value.id]);
                const maxElements = this.degree;
                if(iContainer.numElements === maxElements) {
                    const splitDepth = await branch.split(maxElements);
                    newRootKey = await branch.update(splitDepth);    //update only from split down to root
                } else {
                    newRootKey = await branch.update();
                }
            }
            this.rootChunk = Chunk.fromKey(newRootKey);
        }
    }

    async get(key) {
        if(key instanceof Chunk === false) {
            throw Error('get() failed: key is not a Chunk');
        }
        if(this.rootChunk) {
            var iContainer = this.rootChunk.expandTo(TreeContainer, true);
            while(iContainer) {
                nextContainerIdentifier = iContainer.follow(key.id);
                if(nextContainerIdentifier === true) {
                    const valueIdentifier = iContainer.getKeyValue(key.id);
                    return Chunk.fromIdentifier(valueIdentifier, this.rootChunk.ownerID);
                }
                iContainer = Chunk.fromIdentifier(nextContainerIdentifier, this.rootChunk.ownerID).expandTo(TreeContainer, true);
            }
        }
        return undefined;
    }

    async* [Symbol.asyncIterator]() {
		if(this.rootChunk) {
			const rootContainer = await TreeContainer.fromChunkID(this.rootChunk.key);
   			for await(const [keyIdentifier, valueIdentifier] of rootContainer.iterator(this.rootChunk.ownerID)) {
                const key = Chunk.fromIdentifier(keyIdentifier);
                const value = Chunk.fromIdentifier(valueIdentifier);
                yield [key, value];
            }
		}
	}
}