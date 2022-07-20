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

    static async validateMapElement(element) {
        if(Array.isArray(element) === false) {
            throw Error('Invalid map element, not an array');
        }
        if(element.length !== 2) {
            throw Error('invalid map element array length, must be 2');
        }
        const key = element[0];
        const value = element[1];
        ResourcesManager.validateKey(key);
        ResourcesManager.validateKey(value);
        return [key, value];
    }

	constructor(degree=5, rootHash, isMap=false) {
		if(Number.isInteger(degree) === false
        || degree < 2
		|| degree > 10) {
			throw Error('invalid tree degree: ' + degree);
		}
        this.isMap = isMap;
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

    async set(key, value) {
        if(this.isMap === false) {
            throw Error('Attempt to set key value in non-map tree');
        }
        const element = [key, value];
        return this.add(element, true);
    }

    async get(key) {
        if(this.isMap === false) {
            throw Error('Attempt to get key value in non-map tree');
        }
        if(this.rootHash !== null
        && this.rootHash !== undefined
        && this.rootHash !== '') {
            var nextContainerHash = this.rootHash;
			do {
				const iContainer = await TreeContainer.fromResource(nextContainerHash, this.ownerID);
				nextContainerHash = iContainer.follow(key);
				if(nextContainerHash === true) {
					return iContainer.getKeyValue(key);
				}
			} while(nextContainerHash !== '');
        }
        return undefined;
    }

	async add(element, update=false) {
        if(this.readOny) {
            throw Error('Attempt to edit a read only hash linked tree');
        }
        var key;
        if(this.isMap) {
            await HashLinkedTree.validateMapElement(element);
            key = element[0];
        } else {
            key = element;
            await ResourcesManager.validateKey(key);
        }
//		logger.log('info', "tree.add(" + JSON.stringify(element, null, 2) + ") -> " + key);
		if(this.rootHash == null
		|| this.rootHash == undefined) {
            var newRoot = new TreeContainer(null, this.isMap);
    		newRoot.add(element);
    		this.rootHash = await ResourcesManager.storeResourceObject(newRoot);
		} else {
            const branch = new TreeBranch(this.ownerID, this.rootHash);
            await branch.getToKey(key);
            var iContainer = branch.getLastContainer();
            if(branch.containsKey) {
                if(update===false) {
                    throw Error('attempt to add a duplicate key');
                }
                if(this.isMap === false) {
                    throw Error('attempt to update key in a non-map tree');
                }
                const value = element[1];
                iContainer.updateKeyValue(key, value);
                this.rootHash = await branch.update();
            } else {
    			iContainer.add(element);
                const maxElements = this.degree;
                if(iContainer.numElements === maxElements) {
                    const splitDepth = await branch.split(maxElements);
                    this.rootHash = await branch.update(splitDepth);    //update only from split down to root
                } else {
                    this.rootHash = await branch.update();
                }
            }
//			logger.log('info', ">>> Tree.add finished, new root is " + this.rootHash);
		}
		return this.rootHash;
	}

    async delete(key) {
        if(this.readOnly) {
            throw Error('Attempt to edit a read only hash linked tree');
        }
		ResourcesManager.validateKey(key);
		if(this.rootHash == null
		|| this.rootHash == undefined) {
            throw Error('tree is empty');
		} else {
            const branch = new TreeBranch(this.ownerID, this.rootHash);
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
                const leftBranch = new TreeBranch(this.ownerID, leftContainerKey);
                await leftBranch.getToRightmostLeaf();
                const leftStealLeaf = leftBranch.getLastContainer();
                const rightBranch = new TreeBranch(this.ownerID, rightContainerKey);
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
            this.rootHash = await branch.update(mergeDepth);
        }
    }

	async has(key) {
		ResourcesManager.validateKey(key);
		if(this.rootHash === null
		|| this.rootHash === undefined) {
			return false;
		} else {
			var nextContainerHash = this.rootHash;
			do {
				const iContainer = await TreeContainer.fromResource(nextContainerHash, this.ownerID);
				nextContainerHash = iContainer.follow(key);
				if(nextContainerHash === true) {
					return true;
				}
			} while(nextContainerHash !== '');
			return false;
		}
	}

	async* [Symbol.asyncIterator]() {
		var branch = [];
		if(this.rootHash !== null
		&& this.rootHash !== undefined
        && this.rootHash !== '') {
			var rootContainer = await TreeContainer.fromResource(this.rootHash, this.ownerID);
            if(this.isMap) {
    			for await(const [key, value] of rootContainer.iterator(this.ownerID)) {
    				yield [key, value];
    			}
            } else {
                for await(const key of rootContainer.iterator(this.ownerID)) {
                    yield key;
                }
            }
		}
	}

	async isEmpty() {
		if(this.rootHash
		&& this.rootHash !== null
		&& this.rootHash !== undefined
        && this.rootHash !== '') {
			const rootElement = await ResourcesManager.getResourceObject(this.rootHash, this.ownerID);
			if(rootElement.numElements > 0) {
				return false;
			}
		}
		return true;
	}

	diff(other) {
		var newElements = new Set();
		//experimental function, returns a set of element hashes
		// that is present in the other tree but not on this one
		return newElements;
	}
};
