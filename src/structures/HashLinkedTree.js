/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {Resource} from '../chunking/Resource
import {TreeBranch} from './TreeBranch';
import {TreeContainer} from './TreeContainer';
import { Utils } from '../basic/Utils';

 
export class HashLinkedTree {

	constructor(degree=5, root=null) {
		this.degree = degree;
		this.root = root;
	}

    async delete(element) {
		if(element instanceof Resource === false) {
            throw Error('key is no an instance of Resource');
        }
        if(this.readOnly) {
            throw Error('Attempt to edit a read only hash linked tree');
        }
        const key = element.key;
		if(this.root == null
		|| this.root == undefined) {
            throw Error('tree is empty');
		} else {
            const branch = new TreeBranch(this.root.key, this.root.ownerID);
            await branch.getToKey(key);
            if(branch.containsKey === false) {
                throw Error('key does not exist in tree');
            }
            // console.log('tree.remove('+key+')');
            const ownerContainer = branch.getLastContainer();
            // console.log('original ownerContainer: ' + JSON.stringify(ownerContainer, null, 2));
            const minElements = Math.floor(this.degree/2);
            var mergeDepth;
            if(ownerContainer.isLeaf()) {
                ownerContainer.remove(key);
                // console.log('ownerContainer after key '+key+' was removed: ' + JSON.stringify(ownerContainer, null, 2));
                if(ownerContainer.numElements < minElements
                && branch.depth > 0) {
                    debugger;
                    mergeDepth = await branch.rebalance(minElements);
                }
            } else {
                const [leftContainerKey, rightContainerKey] = ownerContainer.getChildrenAroundKey(key);
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
            this.root = Resource.fromKey(newRootKey);
        }
    }

	async has(keyResource) {
        if(keyResource instanceof Resource === false) {
            throw Error('key is not an instance of Resource');
        }
        const key = keyResource.key;
		if(this.root === null
		|| this.root === undefined) {
			return false;
		} else {
			var nextContainerHash = this.root.key;
			do {
				const iContainer = await TreeContainer.fromChunkID(nextContainerHash, this.ownerID);
				nextContainerHash = iContainer.follow(key);
				if(nextContainerHash === true) {
					return true;
				}
			} while(nextContainerHash !== '');
			return false;
		}
	}

	async isEmpty() {
		if(this.root
		&& this.root !== null
		&& this.root !== undefined) {
            const rootObject = await this.root.expand();
			if(rootObject.numElements > 0) {
				return false;
			}
		}
		return true;
	}

};
