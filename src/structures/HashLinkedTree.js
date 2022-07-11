/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

 import {ResourcesManager} from '../resources/ResourcesManager';
 import {TreeBranch} from './TreeBranch';
 import {TreeContainer} from './TreeContainer';
 import {Utils} from '../basic/Utils';
 import {logger} from '../basic/Log';

export class HashLinkedTree {

	constructor(degree=5, rootHash) {
		if(Number.isInteger(degree) === false
        || degree < 2
		|| degree > 10) {
			throw Error('invalid tree degree: ' + degree);
		}
		this.degree = degree;
		this.setState(rootHash);
	}

    setOwnerID(id) {
        ResourcesManager.validateKey(id);
        this.ownerID = id;
        if(id !== host.id) {
            this.readOnly = true;
        }
    }

	setState(state) {
		if(state === null
		|| state === undefined
		|| state === '') {
			this.rootHash = null;
		} else {
			ResourcesManager.validateKey(state);
			//TODO: root element structure validation?
			this.rootHash = state;
		}
	}

	getState() {
		var stateId = this.rootHash;
		return stateId;
	}

	//Start a new tree with a given initial element
	async init(firstElementHash) {
		var newRoot = new TreeContainer();
		if(firstElementHash !== null
		&& firstElementHash !== undefined) {
			newRoot.add(firstElementHash);
		}
		this.rootHash = await ResourcesManager.storeResourceObject(newRoot);
//		logger.log('info', "New tree root: \'" + this.rootHash + "\'");
	}

	async validate(element, storeFlag) {
		var elementHash;
		//Treat objects or hashes deppending on param format
		if(typeof element === 'object') {
			if(storeFlag == null
			|| storeFlag == undefined
			|| storeFlag == false) {
				elementHash = await ResourcesManager.generateKeyForObject(element);
			} else {
				elementHash = await ResourcesManager.storeResourceObject(element);
			}
		} else
		if(Utils.isBase64(element)) {
			elementHash = element;
		} else {
			throw Error('invalid element type');
		}
		return elementHash;
	}

	async add(element) {
        if(this.readOny) {
            throw Error('Attempt to edit a read only hash linked tree');
        }
		var key = await this.validate(element);
//		logger.log('info', "tree.add(" + JSON.stringify(element, null, 2) + ") -> " + key);
		if(this.rootHash == null
		|| this.rootHash == undefined) {
			await this.init(key);
		} else {
            const branch = new TreeBranch(this.ownerID, this.rootHash);
            await branch.getToKey(key);
            if(branch.containsKey) {
                throw Error('element already in set');
            }
			//Leaf add
            var depth = branch.depth;
            var iContainer = branch.containers[branch.depth];
			iContainer.add(key);
            //Check split criteria
			while(iContainer.numElements === this.degree) {
//				logger.log('info', "SPLIT! Depth:" + depth);
				var rightContainer = new TreeContainer();
				var meanElement = iContainer.split(rightContainer);
				var leftContainer = iContainer;
				var leftContainerKey = await ResourcesManager.storeResourceObject(leftContainer);
                var rightContainerKey = await ResourcesManager.storeResourceObject(rightContainer);
				if(depth === 0) { //ROOT SPLIT
					var newRoot = new TreeContainer(leftContainerKey);
					newRoot.add(meanElement, rightContainerKey);
					branch.containers.unshift(newRoot);
//					logger.log('info', "New tree root: " + JSON.stringify(newRoot, null , 2)
//						+ " -> " + branch.containers[0]);
					break;
				} else {
					//Add element to lower (closer to root) container and
					// continue split check
					iContainer = branch.containers[depth-1];
//					logger.log('info', "Updating branch at depth=" + depth
//						+ "\n>prevHash: " + prevBranchHashes[depth]
//						+ "\n>currentHash: " + leftContainerKey);
					iContainer.updateChild(branch.containerKeys[depth], leftContainerKey);
					iContainer.add(meanElement, rightContainerKey);
					depth--;
				}
			}
			this.rootHash = await branch.update(depth);
//			logger.log('info', ">>> Tree.add finished, new root is " + this.rootHash);
		}
		return this.rootHash;
	}

    async remove(element) {
        if(this.readOny) {
            throw Error('Attempt to edit a read only hash linked tree');
        }
		var key = await this.validate(element);
//		logger.log('info', "tree.add(" + JSON.stringify(element, null, 2) + ") -> " + key);
		if(this.rootHash == null
		|| this.rootHash == undefined) {
            throw Error('Tree is empty');
		} else {
            const branch = new TreeBranch(this.ownerID, this.rootHash);
            await branch.getToKey(key);
            if(branch.containsKey === false) {
                throw Error('Element does not exist in tree');
            }
            const ownerContainer = branch.containers[branch.depth];
            console.log('original ownerContainer: ' + JSON.stringify(ownerContainer, null, 2));
            const minElements = Math.floor(this.degree/2);
            if(ownerContainer.isLeaf()) {
                ownerContainer.remove(key);
                console.log('ownerContainer after key '+key+' was removed: ' + JSON.stringify(ownerContainer, null, 2));
                if(ownerContainer.numElements < minElements
                && branch.depth > 0) {
                    await branch.rebalance();
                }
            } else {
                const leftBranch = new TreeBranch(this.ownerID, leftContainerKey);
                await leftBranch.getToRightmostLeaf();
                const leftStealLeaf = leftBranch.containers[leftBranch.depth];
                const rightBranch = new TreeBranch(this.ownerID, rightContainerKey);
                await rightBranch.getToLeftmostLeaf();
                const rightStealLeaf = rightBranch.containers[rightBranch.depth];
                var stolenKey;
                if(leftStealLeaf.numElements > rightStealLeaf.numElements) {
                    const [poppedKey, poppedSiblingKey] = await leftStealLeaf.pop();
                    stolenKey = poppedKey;
                    console.log('Stealing '+stolenKey+' from left subtree');
                    branch.append(leftBranch);
                    debugger;
                } else {
                    const [shiftedKey, shiftedSiblingKey] = await leftStealLeaf.shift();
                    stolenKey = shiftedKey;
                    console.log('Stealing '+stolenKey+' from right subtree');
                    branch.append(rightBranch);
                    debugger;
                }
                ownerContainer.substituteKey(key, stolenKey);
                console.log('Owner after steal: ' + JSON.stringify(ownerContainer, null, 2));
                const branchLeaf = branch.containers[branch.depth].
                if(branchLeaf.numElements < minElements) {
                    await branch.rebalance();
                }
            }
            this.rootHash = await branch.update();
        }
    }

	async has(element) {
		const elementHash = await this.validate(element, false);
//		logger.log('info', "tree.has(" + elementHash + ")");
		if(this.rootHash == null
		|| this.rootHash == undefined) {
			return false;
		} else {
			var iContainer;
			var nextContainerHash = this.rootHash;
			var depth = 0;
			do {
				iContainer = await TreeContainer.fromResource(nextContainerHash, this.ownerID);
//				logger.log('info', "search["+depth+"]: " + JSON.stringify(iContainer, null, 2));
				nextContainerHash = iContainer.follow(elementHash);
				depth++;
//				logger.log('info', "follow->" + nextContainerHash);
				if(nextContainerHash === true) {
//					logger.log('info', "Element found");
					return true;
				}
			} while(nextContainerHash !== '');
//			logger.log('info', "Element NOT found");
			return false;
		}
	}

	async* [Symbol.asyncIterator]() {
		var branch = [];
		if(this.rootHash != null
		&& this.rootHash != undefined) {
			var rootContainer = await TreeContainer.fromResource(this.rootHash, this.ownerID);
			for await(const element of rootContainer.iterator(this.ownerID)) {
				yield element;
			}
		}
	}

	async isEmpty() {
		if(this.rootHash
		&& this.rootHash !== null
		&& this.rootHash !== undefined) {
			const rootElement = await ResourcesManager.getResourceObject(this.rootHash, this.ownerID);
			if(rootElement.numElements > 0) {
				return true;
			}
		}
		return false;
	}

	diff(other) {
		var newElements = new Set();
		//experimental function, returns a set of element hashes
		// that is present in the other tree but not on this one
		return newElements;
	}
};
