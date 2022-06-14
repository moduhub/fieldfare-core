/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

 import {ResourcesManager} from '../resources/ResourcesManager';
 import {Utils} from '../basic/Utils';
 import {logger} from '../basic/Log';

var Symbol = require("es6-symbol");

class TreeContainer {

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

	static async fromResource(hash) {

		var newContainer = new TreeContainer();

		const resourceObject = await ResourcesManager.getResourceObject(hash);

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

	async* [Symbol.asyncIterator]() {

		if(this.children[0] !== '') {

			const leftmostChild = await TreeContainer.fromResource(this.children[0]);

			//Descent on leftmost child
			for await (const element of leftmostChild) {
				yield element;
			}

		}

		for(var i=0; i<this.numElements; i++) {

			//Intercalate children with branches
			yield this.elements[i];

			if(this.children[i+1] !== '') {

				var iChild = await TreeContainer.fromResource(this.children[i+1]);

				for await (const element of iChild) {
					yield element;
				}
			}

		}


	}

	//Runs the callback following hash order of the set
	async forEach(callback) {

		if(this.children[0] !== '') {

			const leftmostChild = await TreeContainer.fromResource(this.children[0]);

			//Descent on leftmost child
			await leftmostChild.forEach(callback);

		}

		for(var i=0; i<this.numElements; i++) {

			//Intercalate children with branches
			callback(this.elements[i]);

			if(this.children[i+1] !== '') {

				var iChild = await TreeContainer.fromResource(this.children[i+1]);

				await iChild.forEach(callback);
			}

		}

	}

};

export class HashLinkedTree {

	constructor(degree=5, rootHash) {

		if(degree <= 0
		|| degree > 10
		|| degree === undefined
		|| degree === null) {
			throw Error('invalid tree order value');
		}

		this.degree = degree;
		this.setState(rootHash);

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

			newRoot.addElement(firstElementHash);

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

		var elementHash = await this.validate(element);

//		logger.log('info', "tree.add(" + JSON.stringify(element, null, 2) + ") -> " + elementHash);

		if(this.rootHash == null
		|| this.rootHash == undefined) {

			logger.log('info', "First insert, init root with \'" + elementHash + "\'");

			await this.init(elementHash);

		} else {

			var prevBranchHashes = new Array();
			var branch = new Array();

			var iContainer = await TreeContainer.fromResource(this.rootHash);

			logger.log('info', 'root->' + JSON.stringify(iContainer, null, 2));

			var depth = 0;
			prevBranchHashes[0] = this.rootHash;//root hash
			branch[0] = iContainer;

			var nextContainerHash = iContainer.follow(elementHash);

			//Get to last container, storing the entire branch
			while(nextContainerHash !== '') {

				if(nextContainerHash === true) {
					throw Error('element already in set');
				}

//				logger.log('info', 'follow->' + nextContainerHash);

				iContainer = await TreeContainer.fromResource(nextContainerHash);
				depth++;

//				logger.log('info', 'depth[' + depth + ']->' + JSON.stringify(iContainer, null, 2));

				if(iContainer == null
				|| iContainer == undefined) {
					throw Error('iContainer object not found');
				}

				prevBranchHashes.push(nextContainerHash);
				branch.push(iContainer);

				nextContainerHash = iContainer.follow(elementHash);

			}

			//logger.log('info', "Destination container prev state: " + JSON.stringify(iContainer, null, 2));

			//Leaf add
			iContainer.addElement(elementHash);

//			logger.log('info', "Inserted new at depth=" + depth
//				+ " -> Container: "  + JSON.stringify(iContainer, null, 2));

			//Perform split if numElements == degree
			while(iContainer.numElements === this.degree) {

//				logger.log('info', "SPLIT! Depth:" + depth);

				var rightContainer = new TreeContainer();

				var meanElement = iContainer.split(rightContainer);

				var leftContainer = iContainer;

				var leftContainerHash = await ResourcesManager.storeResourceObject(leftContainer);
				var rightContainerHash = await ResourcesManager.storeResourceObject(rightContainer);

//				logger.log('info', "Mean element: " + meanElement);
//				logger.log('info', "Left (" + leftContainerHash + "): "  + JSON.stringify(leftContainer, null, 2));
//				logger.log('info', "Right (" + rightContainerHash + "): "  + JSON.stringify(rightContainer, null, 2));

				// After split:
				// * Mean element is inserted in upper container
				// * May split recursively down to root

				if(depth === 0) { //ROOT SPLIT

					//create new root from scratch
					var newRoot = new TreeContainer(leftContainerHash);

					newRoot.addElement(meanElement, rightContainerHash);

					branch.unshift(newRoot);

//					logger.log('info', "New tree root: " + JSON.stringify(newRoot, null , 2)
//						+ " -> " + branch[0]);

					break;

				} else {

					//Add element to lower (closer to root) container and
					// continue split check
					iContainer = branch[depth-1];

//					logger.log('info', "Updating branch at depth=" + depth
//						+ "\n>prevHash: " + prevBranchHashes[depth]
//						+ "\n>currentHash: " + leftContainerHash);

//					logger.log('info', ">>> Depth lowered to: " + depth);
//					logger.log('info', ">>> iContainer prev state: " + JSON.stringify(iContainer, null, 2));

					iContainer.updateChild(prevBranchHashes[depth], leftContainerHash);
					iContainer.addElement(meanElement, rightContainerHash);

//					logger.log('info', ">>> iContainer after state: " + JSON.stringify(iContainer, null, 2));

					depth--;
				}

			}

			//Split may or may not have ocurred
			// At this point, depth contains the lowest container that changed
			// and branch must now update everything down to root
			// with new hash linkage

//			logger.log('info', "Branch length: " + branch.length
//				+ " Starting branch update at depth="+depth);

			//Update branch down (up?) to root
			while(depth > 0) {

				const currentContainerHash = await ResourcesManager.storeResourceObject(branch[depth]);

//				logger.log('info',   "depth: " + depth
//					+ "current: " + currentContainerHash
//					+ " prev: " + prevBranchHashes[depth]);

				if(currentContainerHash !== prevBranchHashes[depth]) {

					branch[depth-1].updateChild(prevBranchHashes[depth], currentContainerHash);

					//Free previous resource?

				} else {
					//this shoould never happen?
					throw Error('this was unexpected, check code');
				}

				depth--;

			}

			//Update root
			this.rootHash = await ResourcesManager.storeResourceObject(branch[0]);

			//Dump previous root?

//			logger.log('info', ">>> Tree.add finished, new root is " + this.rootHash);
		}

		return this.rootHash;
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

				iContainer = await TreeContainer.fromResource(nextContainerHash);

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

			var rootContainer = await TreeContainer.fromResource(this.rootHash);

			for await(const element of rootContainer) {
				yield element;
			}

		}
	}

	async forEach(callback) {

		if(this.rootHash != null
		&& this.rootHash != undefined) {

			var rootContainer = await TreeContainer.fromResource(this.rootHash);

			rootContainer.forEach(callback);

		}

	}

	async isEmpty() {

		if(this.rootHash
		&& this.rootHash !== null
		&& this.rootHash !== undefined) {

			const rootElement = await ResourcesManager.getResourceObject(this.rootHash);

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
