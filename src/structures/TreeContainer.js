// 2023 Adan Kvitschal <adan@moduhub.com>

import { ChunkingUtils } from '../chunking/ChunkingUtils';
import { ChunkManager } from '../chunking/ChunkManager';
import { Utils } from '../basic/Utils';

/**
 * TreeContainer class is the basic building block for any HashLinked Tree strucutre,
 * like set and maps of objects. It stores Chunk indentifier and allows navigating
 * and building branches.
 */
export class TreeContainer {

	constructor(leftChild=null, isMap=false) {
		this.keys = [];
		this.children = [];
		if(isMap) {
			this.values = [];
		}
		if(leftChild === null
		|| leftChild === undefined
		|| leftChild === '') {
			this.children[0] = '';
		} else {
			ChunkingUtils.validateIdentifier(leftChild);
			this.children[0] = leftChild;
		}
		this.numElements = 0;
	}

	static async validateParameters(rawObject) {
		Utils.validateParameters(rawObject, ['keys', 'children', 'numElements'], ['values']);
		if(rawObject.keys instanceof Array === false
		|| rawObject.children instanceof Array === false
		|| Number.isInteger(rawObject.numElements) === false) {
			throw Error('one of TreeContainer Chunk parameters has invalid type');
		}
	}

	static async fromChunkIdentifier(identifier, ownerID) {
		var newContainer = new TreeContainer();
		const rawObject = await ChunkManager.getObjectFromIdentifier(identifier, ownerID);
		if(rawObject === null
		|| rawObject === undefined) {
			throw Error('failed to fetch container chunk');
		}
		if('elements' in rawObject) { //add translation from HLT 0.0.x format
			rawObject.keys = rawObject.elements;
			delete rawObject.elements;
		}
		Utils.validateParameters(rawObject, ['keys', 'children', 'numElements'], ['values']);
		Object.assign(newContainer, rawObject);
		return newContainer;
	}

	isLeaf() {
		for(const child of this.children) {
			if(child !== '') {
				return false;
			}
		}
		return true;
	}

	/**
	 * Add an element to the Tree Container in the correct position
	 * considering key order. 
	 * If the container is of 'set' type, contents must be a key in base64 format
	 * If container is of 'map' type, contents must be an array containing a [key, value] pair.
	 * @param {*} contents A chunk identifier in base64 format, or an array
	 * containing [key, value] pair of chunk identifiers
	 * @param {string} rightChildKey identifier of the rightChild chunk in base64 format
	 */
	add(contents, rightChildKey) {
		var key, value;
		if(this.values) {
			if(Array.isArray(contents) === undefined) {
				throw Error('Attempt to insert value in non-map container');
			}
			key = contents[0];
			value = contents[1];
			ChunkingUtils.validateIdentifier(value);
		} else {
			key = contents;
		}
		ChunkingUtils.validateIdentifier(key);
		if(rightChildKey === undefined
		|| rightChildKey === null
		|| rightChildKey === '') {
			rightChildKey = '';
		} else {
			ChunkingUtils.validateIdentifier(rightChildKey);
		}
		if(this.numElements === 0) {
			this.keys[0] = key;
			if(this.values) {
				this.values[0] = value;
			}
			this.children[1] = rightChildKey;
		} else {
			if(key < this.keys[0]) {
				this.keys.unshift(key);
				if(this.values) {
					this.values.unshift(value);
				}
				this.children.splice(1, 0, rightChildKey);
			} else {
				var insertIndex = 1;
				for(var i=0; i<this.numElements; i++) {
					if(key > this.keys[i]) {
						insertIndex = i+1;
					} else {
						break;
					}
				}
				this.keys.splice(insertIndex, 0, key);
				if(this.values) {
					this.values.splice(insertIndex, 0, value);
				}
				this.children.splice(insertIndex+1, 0, rightChildKey);
			}
		}
		this.numElements++;
	}

	unshift(element, leftChild='') {
		var key, value;
		if(Array.isArray(element)) {
			if(this.values === undefined) {
				throw Error('Attempt to insert value in non-map container');
			}
			key = element[0];
			value = element[1];
		} else {
			key = element;
		}
		this.keys.unshift(key);
		if(this.values) {
			this.values.unshift(value);
		}
        this.children.unshift(leftChild);
        return (++this.numElements);
	}

	shift() {
		var leftmostElement;
		const leftmostKey = this.keys.shift();
		const leftmostChild = this.children.shift();
		if(this.values) {
			const leftmostValue = this.values.shift();
			leftmostElement = [leftmostKey, leftmostValue];
		} else {
			leftmostElement=leftmostKey;
		}
        this.numElements--;
		return [leftmostElement, leftmostChild];
    }

	push(element, rightChild='') {
		var key, value;
		if(Array.isArray(element)) {
			if(this.values === undefined) {
				throw Error('Attempt to insert value in non-map container');
			}
			key = element[0];
			value = element[1];
		} else {
			key = element;
		}
		this.keys.push(key);
		if(this.values) {
			this.values.push(value);
		}
        this.children.push(rightChild);
        return (++this.numElements);
	}

    pop() {
		var rightmostElement;
		const rightmostKey = this.keys.pop();
		const rightmostChild = this.children.pop();
		if(this.values) {
			const rightmostValue = this.values.pop();
			rightmostElement = [rightmostKey, rightmostValue];
		} else {
			rightmostElement=rightmostKey;
		}
		this.numElements--;
		return [rightmostElement, rightmostChild];
    }

    //1) key is deleted
	//2) Left child is poped out
    //3) [leftKey, leftChild, rightChild] is retuned
    remove(key) {
        const index = this.keys.indexOf(key);
        if(index === -1) {
            throw Error('key not found');
        }
        var leftKey = '';
        if(index > 0){
            leftKey = this.keys[index-1];
        }
        const leftChild = this.children[index];
        const rightChild = this.children[index+1];
        this.keys.splice(index, 1);
		if(this.values) {
			this.values.splice(index, 1);
		}
        this.children.splice(index, 1);
        this.numElements--;
        return [leftKey, leftChild, rightChild];
    }

	substituteElement(oldKey, newElement) {
		const index = this.keys.indexOf(oldKey);
		if(index === -1) {
			throw Error('old key \''+oldKey+'\' not found');
		}
		if(this.values) {
			if(Array.isArray(newElement) === false) {
				throw Error('Attempt to substitute key in map, but no value provided');
			}
			this.keys[index] = newElement[0];
			this.values[index] = newElement[1];
		} else {
			this.keys[index] = newElement;
		}
	}

	getChildrenAroundKey(key) {
		const index = this.keys.indexOf(key);
		if(index === -1) {
			throw Error('key not found');
		}
		return [this.children[index],this.children[index+1]];
	}

	getLeftmostChild() {
		return this.children[0];
	}

	getRightmostChild() {
		return this.children[this.numElements];
	}

	getLeftSibling(childKey) {
		const index = this.children.indexOf(childKey);
		if(index === -1) {
			throw Error('old key not found');
		}
		var leftSibling = '';
		var leftElement = '';
		if(index > 0) {
			leftSibling = this.children[index-1];
			if(this.values) {
				leftElement = [this.keys[index-1], this.values[index-1]];
			} else {
				leftElement = this.keys[index-1];
			}
		}
		return [leftSibling, leftElement];
	}

	getRightSibling(childKey) {
		const index = this.children.indexOf(childKey);
		if(index === -1) {
			throw Error('old key not found');
		}
		var rightSibling = '';
		var rightElement = '';
		if(index < this.numElements) {
			rightSibling = this.children[index+1];
			if(this.values) {
				rightElement = [this.keys[index], this.values[index]];
			} else {
				rightElement = this.keys[index];
			}

		}
		return [rightSibling, rightElement];
	}

	updateChild(prev, current) {
		var index;
//		logger.log('info', ">>> Updating child " + prev + "->" + current);
		for(var i=0; i<this.numElements+1; i++) {
			if(this.children[i] === prev) {
				index = i;
				this.children[i] = current;
				break;
			}
			// else
			// if(this.children[i] === current) {
			// 	//key already current, accept
			// 	index = i;
			// 	break;
			// }
		}
		if(index === undefined) {
			throw Error('child \''+prev+'\' not found in container');
		}
		return index;
	}

	//Split:
	// 1) Mean element is popped out
	// 2) Left element stays
	// 3) Right element is returned
	split(rightContainer) {
		//find mean element
		const meanIndex = Math.floor((this.numElements-1)/2);
		var meanElement;
		if(this.values) {
			meanElement = [this.keys[meanIndex], this.values[meanIndex]];
		} else {
			meanElement = this.keys[meanIndex];
		}
		const numRightElements = this.numElements - meanIndex - 1;
		rightContainer.keys = this.keys.splice(meanIndex, numRightElements+2);
		rightContainer.keys.splice(0,1);
		if(this.values) {
			rightContainer.values = this.values.splice(meanIndex, numRightElements+2);
			rightContainer.values.splice(0,1)
		}
		rightContainer.children = this.children.splice(meanIndex+1, numRightElements+1);
		this.numElements -= numRightElements+1;
		rightContainer.numElements = numRightElements;
		return meanElement;
	}

	mergeChildren(key, mergedChildKey) {
		const index = this.keys.indexOf(key);
		if(index === -1) {
			throw Error('old key \''+key+'\' not found');
		}
		this.keys.splice(index, 1);
		if(this.values) {
			this.values.splice(index, 1);
		}
		this.children.splice(index, 1);
		this.children[index] = mergedChildKey;
		this.numElements--;
		return this.numElements;
	}

	mergeLeft(left, meanElement) {
		var meanKey;
		if(this.values) {
			meanKey = meanElement[0];
			const meanValue = meanElement[1];
			this.values = [...left.values, meanValue, ...this.values];
		} else {
			meanKey = meanElement;
		}
		this.keys = [...left.keys, meanKey, ...this.keys];
		this.children = [...left.children, ...this.children];
		this.numElements += left.numElements + 1;
	}

	mergeRight(right, meanElement) {
		var meanKey;
		if(this.values) {
			meanKey = meanElement[0];
			const meanValue = meanElement[1];
			this.values = [...this.values, meanValue, ...right.values];
		} else {
			meanKey = meanElement;
		}
		this.keys = [...this.keys, meanKey, ...right.keys];
		this.children = [...this.children, ...right.children];
		this.numElements += right.numElements + 1;
	}

	follow(key) {
		var childIndex = 0;
		if(key > this.keys[0]) {
			for(var i=0; i<this.numElements; i++) {
				if(key > this.keys[i]) {
					childIndex = i+1;
				} else
				if (key === this.keys[i]) {
					//Found exact same element
					return true;
				} else {
					break;
				}
			}
		} else
		if(key === this.keys[0]) {
			//Found element on first position
			return true;
		}
		return this.children[childIndex];
	}

	/**
	 * Update the value assigned to the key given.
	 * @param {string} key key in base64 format
	 * @param {*} value value in base64 format
	 */
	updateKeyValue(key, value) {
		if(this.values === undefined) {
			throw Error('Attemp to update key value in non-map container');
		}
		const index = this.keys.indexOf(key);
		if(index === -1) {
			throw Error('key \''+key+'\' not found');
		}
		this.values[index] = value;
	}

	getKeyValue(key) {
		if(this.values === undefined) {
			throw Error('Attemp to get key value in non-map container');
		}
		const index = this.keys.indexOf(key);
		if(index === -1) {
			throw Error('key \''+key+'\' not found');
		}
		return this.values[index];
	}

	async* iterator(ownerID) {
		if(this.children[0] !== '') {
			const leftmostChild = await TreeContainer.fromChunkID(this.children[0], ownerID);
			//Descent on leftmost child
			for await (const element of leftmostChild.iterator(ownerID)) {
				yield element;
			}
		}
		for(var i=0; i<this.numElements; i++) {
			//Interleave children with branches
			if(this.values) {
				yield [this.keys[i], this.values[i]];
			} else {
				yield this.keys[i];
			}
			if(this.children[i+1] !== '') {
				var iChild = await TreeContainer.fromChunkID(this.children[i+1], ownerID);
				for await (const element of iChild.iterator(ownerID)) {
					yield element;
				}
			}
		}
	}
};
