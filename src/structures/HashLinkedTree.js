/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

 import {ResourcesManager} from '../resources/ResourcesManager';
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

    //Get to last container, storing the entire branch
    async getBranch(key) {
        var branch = {
            key: key,
            depth: 0,
            containerKeys: [],
            containers: [],
            containsKey: false
        }
        var iContainer = await TreeContainer.fromResource(this.rootHash, this.ownerID);
        branch.containerKeys[0] = this.rootHash;
        branch.containers[0] = iContainer;
        var nextContainerKey = iContainer.follow(key);
        while(nextContainerKey !== '') {
            if(nextContainerKey === true) {
                branch.containsKey = true;
                break;
            }
            iContainer = await TreeContainer.fromResource(nextContainerKey, this.ownerID);
            branch.depth++;
            if(iContainer === null
            || iContainer === undefined) {
                throw Error('iContainer object not found');
            }
            branch.containerKeys.push(nextContainerKey);
            branch.containers.push(iContainer);
            nextContainerKey = iContainer.follow(key);
        }
        return branch;
    }

    async updateBranch(branch, depth) {
        if(depth === undefined) {
            depth = branch.depth;
        }
        while(depth > 0) {
            const newContainerKey = await ResourcesManager.storeResourceObject(branch.containers[depth]);
			// logger.log('info',   "depth: " + depth
			// 	+ "current: " + currentContainerHash
			// 	+ " prev: " + prevBranchHashes[depth]);
            if(newContainerKey !== branch.containerKeys[depth]) {
                branch.containers[depth-1].updateChild(branch.containerKeys[depth], newContainerKey);
                //Free previous resource?
            } else {
                //this should never happen?
                throw Error('this was unexpected, check code');
            }
            depth--;
        }
        const newRoot = await ResourcesManager.storeResourceObject(branch.containers[0]);
        return newRoot;
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
            const branch = await this.getBranch(key);
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
			this.rootHash = await this.updateBranch(branch, depth);
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
            const branch = await this.getBranch(key);
            if(branch.containsKey === false) {
                throw Error('Element does not exist in tree');
            }
            const ownerContainer = branch.containers[branch.depth];
            const [leftKey, leftContainerKey, rightContainerKey] = ownerContainer.remove(key);
            const minElements = Math.floor(this.order/2);
            if(leftContainerKey === '') { //is leaf
                if(ownerContainer.numElements < minElements) {
                    if(depth > 0) {
                        const parentContainer = branch.container[depth-1];
                        const [leftNeighborKey, rightNeighborKey, parentKey] = parentContainer.popChild(branch.prevHashes[depth]);
                        const leftNeighbor = await TreeContainer.fromResource(leftNeighborKey, this.ownerID);
                        const rightNeighbor = await TreeContainer.fromResource(rightNeighborKey, this.ownerID);
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
                }
            } else { //internal node
                const leftContainer = await TreeContainer.fromResource(leftContainerKey, this.ownerID);
                const rightContainer = await TreeContainer.fromResource(rightContainerKey, this.ownerID);
                if(leftContainer.numElements > minElements) {
                    const [downKey, downChild] = await leftContainer.popRight();
                    ownerContainer.add(downKey, downChild);
                } else
                if(rightContainer.numElements > minElements) {
                    const [downKey, downChild] = await rightContainer.popLeft();
                    ownerContainer.add(downKey, downChild);
                } else {
                    //case III, only one that causes tree shrink
                    //merge left and right
                    rightContainer.mergeLeft(leftContainer, 'which key?');
                }
            }
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
