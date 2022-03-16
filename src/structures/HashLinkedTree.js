/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Utils = require('../Utils.js');

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
				throw 'invalid right child - not base64';
			}
			
			this.children[0] = leftChild;
		}
		
		this.numElements = 0;
	}
	
	static async fromResource(hash) {
		
		var newContainer = new TreeContainer();

		const resourceObject = await host.getResourceObject(hash);

		if(resourceObject === null
		|| resourceObject === undefined) {
			throw 'failed to fetch container resorce';
		}
		
		Object.assign(newContainer, resourceObject);
		
		return newContainer;
	}
	
	addElement(hash, rightChild) {

		//Parameters validation
		if(Utils.isBase64(hash) === false) {
			throw 'invalid element hash';
		}
		
		if(rightChild === null
		|| rightChild === undefined) {
			rightChild = '';
		} else	
		if(rightChild !== ''
		&& Utils.isBase64(rightChild) === false) {
			throw 'invalid right child - not base64';
		}
		
		if(this.numElements == 0) {
			this.elements[0] = hash;
			this.children[1] = rightChild;
		} else {
			for(var i=0; i<this.numElements; i++) {
				if(this.elements[i] > hash) {
					this.elements.splice(i, 0, hash);
					this.children.splice(i, 0, rightChild);
					break;
				}
			}
		}
		
		this.numElements++;
			
	}
	
	updateChild(prev, current) {
		
		var index = undefined;
		
		for(var i=0; i<this.numElements; i++) {
			if(this.children[i] === prev) {
				index = i;
				this.children[i] = current;
				break;
			}
		}
		
		if(index === undefined) {
			throw 'child not found in container';
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
		
		var nextChild = this.children[0];
		
		//search for hash in elements
		for(var i=0; i<this.numElements; i++) {
			if(this.elements[i] > hash) {
				nextChild = this.children[i+1];
				break;
			} else 
			if(this.elements[i] < hash) {
				nextChild = this.children[i];
			} else {
				//Found exact same element
				throw 'element already in the tree';
			}
		}
	
		return nextChild;
	}
};

module.exports = class HashLinkedTree {
	
	constructor(degree, rootHash) {
		
		if(degree <= 0
		|| degree > 10
		|| degree === undefined
		|| degree === null) {
			throw 'invalid tree order value';
		}
		
		this.degree = degree;
		
		if(rootHash == null
		|| rootHash == undefined) {
		
			this.rootHash = null;	
			
		} else {
			
			if(Utils.isBase64(rootHash) === false) {
				throw 'root is not base64';
			}
			
			//TODO: root element structure validation?
			
			this.rootHash = rootHash;
		}
		
	}
		
	//Start a new tree with a given initial element
	async init(firstElementHash) {
		
		var newRoot = new TreeContainer();
		
		if(firstElementHash !== null
		&& firstElementHash !== undefined) {
		
			newRoot.addElement(firstElementHash);
			
		}
		
		this.rootHash = await host.storeResourceObject(newRoot);

		console.log("New tree root: \'" + this.rootHash + "\'");
		
	}
	
	async add(element) {
		
		var elementHash;
		
		//Treat objects or hashes deppending on param format
		if(typeof element === 'object') {
			
			elementHash = await host.storeResourceObject(element);
			
			console.log("tree.add(" + JSON.stringify(element, null, 2) + ") -> " + elementHash);
			
		} else
		if(Utils.isBase64(element)) {
			
			elementHash = element;
			
		} else {
			throw 'invalid element type';
		}
		
		if(this.rootHash == null
		|| this.rootHash == undefined) {
		
			//console.log("First insert, init root with \'" + elementHash + "\'");
		
			await this.init(elementHash);
		
		} else {
			
			var prevBranchHashes = new Array();
			var branch = new Array();

			var iContainer = await TreeContainer.fromResource(this.rootHash);

			var depth = 0;
			prevBranchHashes[0] = this.rootHash;//root hash
			branch[0] = iContainer;

			var nextContainerHash = iContainer.follow(elementHash);

			//Get to last container, storing the entire branch
			while(nextContainerHash !== '') {

				iContainer = await TreeContainer.fromResource(nextContainerHash);
				depth++;			

				console.log('iContainer: ' + JSON.stringify(iContainer));

				if(iContainer == null
				|| iContainer == undefined) {
					throw 'iContainer object not found';
				}

				prevBranchHashes.unshift(nextContainerHash);
				branch.unshift(iContainer);

				nextContainerHash = iContainer.follow(elementHash);

				console.log('nextContainerHash: ' + nextContainerHash);

			}

			//Leaf add
			iContainer.addElement(elementHash, '');

			console.log("Container updated at depth " + depth + " : "  + JSON.stringify(iContainer));

			//Perform split if numElements == degree
			while(iContainer.numElements == this.degree) {

				console.log("SPLIT! Depth:" + depth);

				var rightContainer = new TreeContainer();

				var meanElement = iContainer.split(rightContainer);

				var rightContainerHash = await host.storeResourceObject(rightContainer);

				console.log("Mean element: " + meanElement);
				console.log("Left (" + 'leftHash' + "): "  + JSON.stringify(iContainer, null, 2));
				console.log("Right (" + rightContainerHash + "): "  + JSON.stringify(rightContainer, null, 2));

				// After split:
				// * Mean element is inserted in upper container
				// * May split recursively down to root

				if(depth == 0) { //ROOT SPLIT

					var iContainerHash = await host.storeResourceObject(iContainer);

					//create new root
					var newRoot = new TreeContainer(iContainerHash);

					newRoot.addElement(meanElement, rightContainerHash);

					this.rootHash = await host.storeResourceObject(newRoot);

					console.log("New tree root: " + JSON.stringify(newRoot, null , 2));

					break;
				} else {

					iContainer = branch[depth--];

					iContainer.addElement(meanElement, rightContainerHash);
				}

			}

			console.log("Branch length: " + branch.length);

			//Update branch down (up?) to root
			for(var i=0; i<branch.length; i++) {

				const currentContainerHash = await host.storeResourceObject(branch[i]);

				console.log(	  "i: " + i
						+ "current: " + currentContainerHash
						+ " prev: " + prevBranchHashes[i]);
				
				if(i == branch.length-1) {
					
					//root
					this.rootHash = currentContainerHash;
					
				} else {
					
					if(currentContainerHash !== prevBranchHashes[i]) {

						branch[i+1].updateChild(prevBranchHashes[i], currentContainerHash);

						//Free previous resource?
					}

				}

			}
		}
	}
	
	diff(other) {
		
		var newElements = new Set();
		
		//experimental function, returns a set of element hashes
		// that is present in the other tree but not on this one
		
		return newElements;
	}
};