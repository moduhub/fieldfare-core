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
            //debugger;
            console.log('original ownerContainer: ' + JSON.stringify(ownerContainer, null, 2));
            const [leftKey, leftContainerKey, rightContainerKey] = ownerContainer.remove(key);
            console.log('ownerContainer after key '+key+' was removed: ' + JSON.stringify(ownerContainer, null, 2));
            const minElements = Math.floor(this.degree/2);
            if(ownerContainer.numElements < minElements) {
                console.log('Num elements underflow, must reorganize!');
                if(leftContainerKey === '') { //is leaf
                    console.log('Container is a leaf, case I');
                    if(depth > 0) {
                        const parentContainer = branch.container[depth-1];
                        const [leftNeighborKey, rightNeighborKey, parentKey] = parentContainer.popChild(branch.prevHashes[depth]);
                        const leftNeighbor = await TreeContainer.fromResource(leftNeighborKey, this.ownerID);
                        const rightNeighbor = await TreeContainer.fromResource(rightNeighborKey, this.ownerID);
                        //debugger;
                        if(leftNeighbor.numElements > minElements) {
                            const [neighborKey, neighborChild] = leftNeighbor.popRight();
                            parentNode.add(neighborKey, neighborChild);
                            ownerContainer.add(parentKey, leftNeighborKey); //todo use new leftNeighborKey
                        } else
                        if(rightNeighbor.numElements > minElements) {
                            const [neighborKey, neighborChild] = rightNeighbor.popLeft();
                            parentNode.add(neighborKey, neighborChild);
                            ownerContainer.add(parentKey, rightNeighborKey); //todo use new rightNeighborKey
                        } else {
                            //Choice between left or right merge is free
                            ownerContainer.mergeLeft(leftNeighbor, parentKey);
                        }
                    } else {
                        //this is the root node
                        if(ownerContainer.numElements === 0) {
                            //removed last element from list
                            this.rootHash = '';
                        }
                    }
                } else { //internal node
                    console.log('Container is internal, case II');
                    // const leftContainer = await TreeContainer.fromResource(leftContainerKey, this.ownerID);
                    // const rightContainer = await TreeContainer.fromResource(rightContainerKey, this.ownerID);
                    // console.log('original leftContainer: ' + JSON.stringify(leftContainer, null, 2));
                    // console.log('original rightContainer: ' + JSON.stringify(rightContainer, null, 2));
                    const leftBranch = new TreeBranch(this.ownerID, leftContainerKey);
                    await leftBranch.getToRightmostLeaf();
                    const leftStealLeaf = leftBranch.containers[leftBranch.depth];
                    const rightBranch = new TreeBranch(this.ownerID, leftContainerKey);
                    await rightContainer.getToLeftmostLeaf();
                    const rightStealLeaf = rightBranch.containers[rightBranch.depth];
                    if(leftStealLeaf.numElements > minElements) {
                        console.log('Stealing from left subtree');
                        const stolenKey = await leftStealLeaf.pop();
                        const newLeftContainerKey = await leftBranch.update();
                        ownerContainer.add(stolenKey, newLeftContainerKey); //or downChild???
                        console.log('[final] Owner after steal from left: ' + JSON.stringify(ownerContainer, null, 2));
                        debugger;
                    } else
                    if(rightStealLeaf.numElements > minElements) {
                        const [downKey, downChild] = await rightContainer.popLeft();
                        ownerContainer.add(downKey, downChild);
                        console.log('[final] Owner after steal from right: ' + JSON.stringify(ownerContainer, null, 2));
                        debugger;
                    } else {
                        //case III, only one that causes tree shrink
                        //merge left and right
                        throw Error('not implemented!');
                        rightContainer.mergeLeft(leftContainer, 'which key?');
                    }
                }
            } else {
                console.log('container num keys greater than minimum, all done!');
            }
            await this.updateBranch(branch);
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
