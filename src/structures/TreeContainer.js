
import {ResourcesManager} from '../resources/ResourcesManager';
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';

export class TreeContainer {

	constructor(leftChild) {

		this.elements = new Array();
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

	static async fromResource(hash, ownerID) {

		var newContainer = new TreeContainer();

		const resourceObject = await ResourcesManager.getResourceObject(hash, ownerID);

		if(resourceObject === null
		|| resourceObject === undefined) {
			throw Error('failed to fetch container resorce');
		}

		Object.assign(newContainer, resourceObject);

		return newContainer;
	}

	addElement(hash, rightChild) {

		//Parameters validation
		if(Utils.isBase64(hash) === false) {
			throw Error('invalid element hash');
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
			this.elements[0] = hash;
			this.children[1] = rightChild;
		} else {
			if(hash < this.elements[0]) {

				this.elements.unshift(hash);
				this.children.splice(1, 0, rightChild);

			} else {

				var insertIndex = 1;

				for(var i=0; i<this.numElements; i++) {
					if(hash > this.elements[i]) {
						insertIndex = i+1;
					} else {
						break;
					}
				}

				this.elements.splice(insertIndex, 0, hash);
				this.children.splice(insertIndex+1, 0, rightChild);
			}
		}

		this.numElements++;

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

		var meanElement = this.elements[meanIndex];

		const numRightElements = this.numElements - meanIndex - 1;

		rightContainer.elements = this.elements.splice(meanIndex, numRightElements+2);
		rightContainer.children = this.children.splice(meanIndex+1, numRightElements+1);

		//fill first element
		rightContainer.elements.splice(0,1);

		this.numElements -= numRightElements+1;
		rightContainer.numElements = numRightElements;

		return meanElement;
	}

	follow(hash) {

		var childIndex = 0;

		if(hash > this.elements[0]) {

			for(var i=0; i<this.numElements; i++) {
				if(hash > this.elements[i]) {
					childIndex = i+1;
				} else
				if (hash == this.elements[i]) {
					//Found exact same element
					return true;
				} else {
					break;
				}
			}
		} else
		if(hash == this.elements[0]) {
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

			//Intercalate children with branches
			yield this.elements[i];

			if(this.children[i+1] !== '') {

				var iChild = await TreeContainer.fromResource(this.children[i+1], ownerID);

				for await (const element of iChild.iterator(ownerID)) {
					yield element;
				}
			}

		}


	}

};
