
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

    //1) key is deleted
    //2) [left, right] children are retuned
    remove(key) {

        const index = this.keys.indexOf(key);

        if(index === -1) {
            throw Error('Element not found');
        }

        this.keys.splice(index, 1);
        const leftChild = this.children(index);
        const rightChild = this.children(index+1);
        this.children.splice(index, 1);

        this.numElements--;

        return [leftChild, rightChild];
    }

	updateChild(prev, current) {

		var index = undefined;

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

	follow(key) {

		var childIndex = 0;

		if(key > this.keys[0]) {

			for(var i=0; i<this.numElements; i++) {
				if(key > this.keys[i]) {
					childIndex = i+1;
				} else
				if (key == this.keys[i]) {
					//Found exact same element
					return true;
				} else {
					break;
				}
			}
		} else
		if(key == this.keys[0]) {
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
