import { HashLinkedTree } from "./HashLinkedTree";
import { Resource } from  "../chunking/Resource
import { TreeContainer } from "./TreeContainer";
import { TreeBranch } from "./TreeBranch";


export class HashLinkedSet extends HashLinkedTree {

    static async fromResource(resource) {
        const descriptor = await resource.expand();
        Utils.validateParameters(descriptor, ['type', 'degree', 'root']);
        HashLinkedTree.validateDegree(descriptor.degree);
        const degree = descriptor.degree;
        if(descriptor.type !== 'set') {
            throw Error('Unexpected type value');
        }
        return new HashLinkedSet(descriptor.degree, descriptor.root);
    }

	toResource() {
		return Resource.fromObject({
            type: 'set',
            degree: this.degree,
            root: this.root
        });
	}

	async add(element) {
        if(this.readOny) {
            throw Error('Attempt to edit a read only hash linked set');
        }
        if(element instanceof Resource === false) {
            throw Error('inserting an element that is not a resource');
        }
        const key = element.key;
		if(this.root === null
		|| this.root === undefined) {
            var newRoot = new TreeContainer(null, false);
    		newRoot.add(key);
    		this.root = await Resource.fromObject(newRoot);
		} else {
            const branch = new TreeBranch(this.root.key, this.root.ownerID);
            await branch.getToKey(key);
            var iContainer = branch.getLastContainer();
            if(branch.containsKey) {
                throw Error('attempt to add a duplicate key');
            }
   			iContainer.add(key);
            const maxElements = this.degree;
            var newRootKey;
            if(iContainer.numElements === maxElements) {
                const splitDepth = await branch.split(maxElements);
                newRootKey = await branch.update(splitDepth);    //update only from split down to root
            } else {
                newRootKey = await branch.update();
            }
            this.root = await Resource.fromKey(newRootKey);
		}
		return this.root;
	}

    async* [Symbol.asyncIterator]() {
		if(this.root !== null
		&& this.root !== undefined
        && this.root !== '') {
			var rootContainer = await TreeContainer.fromChunkID(this.root.key);
            for await(const key of rootContainer.iterator(this.root.ownerID)) {
                const keyResource = Resource.fromKey(key);
                yield keyResource;
            }
		}
	}

}