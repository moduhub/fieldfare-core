
import {ResourcesManager} from '../resources/ResourcesManager';
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';

export class TreeContainer {

	constructor(leftChild) {

		this.keys = new Array();
		this.children = new Array();

		if(leftChild == null
		|| leftChild == undefined) {

			this.children[0] = '';

		} else {
			if(leftChild !== ''
			&& Utils.isBase64(leftChild) === false) {
				throw Error('invalid right child - not base64');
			}

			this.children[0] = leftChild;
		}

		this.numElements = 0;
	}

	static async fromResource(key, ownerID) {

		var newContainer = new TreeContainer();

		const resourceObject = await ResourcesManager.getResourceObject(key, ownerID);

		if(resourceObject === null
		|| resourceObject === undefined) {
			throw Error('failed to fetch container resorce');
		}

		Object.assign(newContainer, resourceObject);

		return newContainer;
	}

	add(key, rightChild) {

		//Parameters validation
		if(Utils.isBase64(key) === false) {
			throw Error('invalid element key');
		}

		if(rightChild === null
		|| rightChild === undefined) {
			rightChild = '';
		} else
		if(rightChild !== ''
		&& Utils.isBase64(rightChild) === false) {
			throw Error('invalid right child - not base64');
		}

		if(this.numElements == 0) {
			this.keys[0] = key;
			this.children[1] = rightChild;
		} else {
			if(key < this.keys[0]) {

				this.keys.unshift(key);
				this.children.splice(1, 0, rightChild);

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
				this.children.splice(insertIndex+1, 0, rightChild);
			}
		}

		this.numElements++;

	}

	unshift(key, leftChild='') {
		this.keys.unshift(key);
        this.children.unshift(leftChild);
        return (++this.numElements);
	}

	shift() {
        const leftmostKey = this.keys.shift();
        const leftmostChild = this.children.shift();
        this.numElements--;
		return [leftmostKey, leftmostChild];
    }

	push(key, rightChild='') {
		this.keys.push(key);
		this.children.push(rightChild);
		return (++this.numElements);
	}

    pop() {
        const rightmostKey = this.keys.pop();
        const rightmostChild = this.children.pop();
        this.numElements--;
		return [rightmostKey, rightmostChild];
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
        this.children.splice(index, 1);
        this.numElements--;
        return [leftKey, leftChild, rightChild];
    }

	substituteKey(oldKey, newKey) {
		const index = this.keys.indexOf(oldKey);
		if(index === -1) {
			throw Error('old key not found');
		}
		this.keys[index] = newKey;
	}

	getLeftSibling(childKey) {
		const index = this.children.indexOf(childKey);
		if(index === -1) {
			throw Error('old key not found');
		}
		var leftSibling = '';
		var leftKey = '';
		if(index > 0) {
			leftSibling = this.children[index-1];
			leftKey = this.keys[index-1];
		}
		return [leftSibling, leftKey];
	}

	getRightSibling(childKey) {
		const index = this.children.indexOf(childKey);
		if(index === -1) {
			throw Error('old key not found');
		}
		var rightSibling = '';
		var rightKey = '';
		if(index < this.numElements) {
			rightSibling = this.children[index+1];
			rightKey = this.keys[index+1];
		}
		return [rightSibling, rightKey];
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
		}
		if(index === undefined) {
			throw Error('child not found in container');
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
		var meanElement = this.keys[meanIndex];
		const numRightElements = this.numElements - meanIndex - 1;
		rightContainer.keys = this.keys.splice(meanIndex, numRightElements+2);
		rightContainer.children = this.children.splice(meanIndex+1, numRightElements+1);
		//fill first element
		rightContainer.keys.splice(0,1);
		this.numElements -= numRightElements+1;
		rightContainer.numElements = numRightElements;
		return meanElement;
	}

	mergeLeft(left, meanKey) {
		this.keys = [left.keys, meanKey, ...this.keys];
		this.children = [left.children, ...this.children];
		this.numElements += left.numElements + 1;
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

	async* iterator(ownerID) {
		if(this.children[0] !== '') {
			const leftmostChild = await TreeContainer.fromResource(this.children[0], ownerID);
			//Descent on leftmost child
			for await (const element of leftmostChild.iterator(ownerID)) {
				yield element;
			}
		}
		for(var i=0; i<this.numElements; i++) {
			//Interleave children with branches
			yield this.keys[i];
			if(this.children[i+1] !== '') {
				var iChild = await TreeContainer.fromResource(this.children[i+1], ownerID);
				for await (const element of iChild.iterator(ownerID)) {
					yield element;
				}
			}
		}
	}
};
