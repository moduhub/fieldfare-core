// 2023 Adan Kvitschal <adan@moduhub.com>

import { Chunk } from '../chunking/Chunk';
import { TreeBranch } from './TreeBranch';
import { TreeContainer } from './TreeContainer';
 
export class ChunkTree {

	constructor(degree=5, root=null, local=true) {
		this.degree = degree;
		this.rootChunk = root;
        this.local = local;
	}

    async delete(key) {
		if(key instanceof Chunk === false) {
            throw Error('key is not a valid Chunk');
        }
        if(!this.local) {
            throw Error('Attempt to edit a remote chunk tree');
        }
		if(this.rootChunk == null
		|| this.rootChunk == undefined) {
            throw Error('tree is empty');
		} else {
            const branch = new TreeBranch(this.rootChunk.id, this.rootChunk.ownerID);
            await branch.getToKey(key.id);
            if(branch.containsKey === false) {
                throw Error('key does not exist in tree');
            }
            // console.log('tree.remove('+key+')');
            const ownerContainer = branch.getLastContainer();
            // console.log('original ownerContainer: ' + JSON.stringify(ownerContainer, null, 2));
            const minElements = Math.floor(this.degree/2);
            var mergeDepth;
            if(ownerContainer.isLeaf()) {
                ownerContainer.remove(key.id);
                // console.log('ownerContainer after key '+key+' was removed: ' + JSON.stringify(ownerContainer, null, 2));
                if(ownerContainer.numElements < minElements
                && branch.depth > 0) {
                    debugger;
                    mergeDepth = await branch.rebalance(minElements);
                }
            } else {
                const [leftContainerKey, rightContainerKey] = ownerContainer.getChildrenAroundKey(key.id);
                const leftBranch = new TreeBranch(leftContainerKey, this.ownerID);
                await leftBranch.getToRightmostLeaf();
                const leftStealLeaf = leftBranch.getLastContainer();
                const rightBranch = new TreeBranch(rightContainerKey, this.ownerID);
                await rightBranch.getToLeftmostLeaf();
                const rightStealLeaf = rightBranch.getLastContainer();
                var stolenElement;
                if(leftStealLeaf.numElements >= rightStealLeaf.numElements) {
                    const [poppedKey, poppedSiblingKey] = await leftStealLeaf.pop();
                    stolenElement = poppedKey;
                    branch.append(leftBranch);
                } else {
                    const [shiftedKey, shiftedSiblingKey] = await rightStealLeaf.shift();
                    stolenElement = shiftedKey;
                    branch.append(rightBranch);
                }
                ownerContainer.substituteElement(key, stolenElement);
                const branchLeaf = branch.getLastContainer();
                if(branchLeaf.numElements < minElements) {
                    debugger;
                    mergeDepth = await branch.rebalance(minElements);
                }
            }
            const newRootKey = await branch.update(mergeDepth);
            this.rootChunk = Chunk.fromIdentfier(newRootKey);
        }
    }

	async has(key) {
        if(key instanceof Chunk === false) {
            throw Error('key is not a valid chunk');
        }
		if(this.rootChunk) {
			var iContainer = this.rootChunk.expandTo(TreeContainer, true);
			while(iContainer) {
				nextContainerIdentifier = iContainer.follow(key.id);
				if(nextContainerIdentifier === true) {
					return true;
				}
                iContainer = Chunk.fromIdentifier(nextContainerIdentifier, this.root.ownerID).expandTo(TreeContainer, true);
			}
		}
        return false;
	}

	async isEmpty() {
		if(this.rootChunk) {
            const rootContainer = await this.rootChunk.expand(0, true);
			if(rootContainer.numElements > 0) {
				return false;
			}
		}
		return true;
	}

};
