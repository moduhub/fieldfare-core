import { HashLinkedTree } from "./HashLinkedTree";
import { TreeContainer } from "./TreeContainer";
import { TreeBranch } from "./TreeBranch";
import { Chunk } from "../chunking/Chunk


export class HashLinkedMap extends HashLinkedTree {
    
    constructor(degree, root) {
        if(Number.isInteger(degree) === false
        || degree < 2
        || degree > 10) {
            throw Error('invalid tree degree: ' + degree);
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
            root: this.root
        });
	}

    async set(keyResource, valueResource) {
        if(this.readOny) {
            throw Error('Attempt to edit a read only hash linked set');
        }
        if(keyResource instanceof Resource === false) {
            throw Error('inserting a key element that is not a resource');
        }
        if(valueResource instanceof Resource === false) {
            throw Error('inserting a value element that is not a resource');
        }
        const key = keyResource.key;
        const value = valueResource.key
		if(this.root === null
		|| this.root === undefined) {
            var newRoot = new TreeContainer(null, true);
    		newRoot.add([key, value]);
    		this.root = await Resource.fromObject(newRoot);
		} else {
            const branch = new TreeBranch(this.root.key, this.root.ownerID);
            await branch.getToKey(key);
            var iContainer = branch.getLastContainer();
            var newRootKey;
            if(branch.containsKey) {
                iContainer.updateKeyValue(key, value);
                newRootKey = await branch.update();
            } else {
                iContainer.add([key, value]);
                const maxElements = this.degree;
                if(iContainer.numElements === maxElements) {
                    const splitDepth = await branch.split(maxElements);
                    newRootKey = await branch.update(splitDepth);    //update only from split down to root
                } else {
                    newRootKey = await branch.update();
                }
            }
            this.root = Resource.fromKey(newRootKey);
        }
    }

    async get(keyResource) {
        if(keyResource instanceof Resource === false) {
            throw Error('get: keyResource is not a Resource');
        }
        const key = keyResource.key;
        if(this.root !== null
        && this.root !== undefined) {
            var nextContainerKey = this.root.key;
			do {
				const iContainer = await TreeContainer.fromChunkID(nextContainerKey, this.root.ownerID);
				nextContainerKey = iContainer.follow(key);
				if(nextContainerKey === true) {
					const valueResourceKey = iContainer.getKeyValue(key);
                    return Resource.fromKey(valueResourceKey, this.root.ownerID);
				}
			} while(nextContainerKey !== '');
        }
        return undefined;
    }

    async* [Symbol.asyncIterator]() {
		if(this.root !== null
		&& this.root !== undefined
        && this.root !== '') {
			var rootContainer = await TreeContainer.fromChunkID(this.root.key);
   			for await(const [key, value] of rootContainer.iterator(this.root.ownerID)) {
                const keyResource = Resource.fromKey(key);
                const valueResource = Resource.fromKey(value);
                yield [keyResource, valueResource];
            }
		}
	}
}