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
			if(this.elements[0] < hash) {
				this.elements.unshift(hash);
				this.children.splice(1, 0, rightChild);
			} else {
				for(var i=0; i<this.numElements; i++) {
					if(this.elements[i] > hash) {
						this.elements.splice(i, 0, hash);
						this.children.splice(i+1, 0, rightChild);
						break;
					}
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

				prevBranchHashes.push(nextContainerHash);
				branch.push(iContainer);

				nextContainerHash = iContainer.follow(elementHash);

				console.log('nextContainerHash: ' + nextContainerHash);

			}

			console.log("Destination container prev state: " + JSON.stringify(iContainer, null, 2));

			//Leaf add
			iContainer.addElement(elementHash);

			console.log("Inserted new at depth=" + depth 
				+ " -> Container: "  + JSON.stringify(iContainer, null, 2));

			//Perform split if numElements == degree
			while(iContainer.numElements == this.degree) {

				console.log("SPLIT! Depth:" + depth);

				var rightContainer = new TreeContainer();

				var meanElement = iContainer.split(rightContainer);

				var leftContainer = iContainer;

				var leftContainerHash = await host.storeResourceObject(leftContainer);
				var rightContainerHash = await host.storeResourceObject(rightContainer);

				console.log("Mean element: " + meanElement);
				console.log("Left (" + leftContainerHash + "): "  + JSON.stringify(leftContainer, null, 2));
				console.log("Right (" + rightContainerHash + "): "  + JSON.stringify(rightContainer, null, 2));

				// After split:
				// * Mean element is inserted in upper container
				// * May split recursively down to root

				if(depth == 0) { //ROOT SPLIT

					//create new root from scratch
					var newRoot = new TreeContainer(leftContainerHash);

					newRoot.addElement(meanElement, rightContainerHash);

					branch.unshift(newRoot);

					console.log("New tree root: " + JSON.stringify(newRoot, null , 2)
						+ " -> " + branch[0]);

					break;
					
				} else {

					//Add element to lower (closer to root) container and
					// continue split check
					iContainer = branch[depth-1];

					iContainer.updateChild(prevBranchHashes[depth-1], leftContainerHash);
					iContainer.addElement(meanElement, rightContainerHash);
					
					depth--;
				}

			}

			//Split may or may not have ocurred
			// At this point, depth contains the lowest container that changed
			// and branch must now update everything down to root
			// with new hash linkage

			console.log("Branch length: " + branch.length
				+ " Starting branch update at depth="+depth);

			//NOTE: This should only run if split did not happen

			//Update branch down (up?) to root
			while(depth > 0) {

				const currentContainerHash = await host.storeResourceObject(branch[depth]);

				console.log(  "depth: " + depth
					+ "current: " + currentContainerHash
					+ " prev: " + prevBranchHashes[depth]);
				
				if(currentContainerHash !== prevBranchHashes[depth]) {

					branch[depth-1].updateChild(prevBranchHashes[i], currentContainerHash);

					//Free previous resource?
				} else {
					//this shoould never happen?
					throw 'this was unexpected, check code';
				}
				
				depth--;

			}
			
			//Update root
			this.rootHash = await host.storeResourceObject(branch[0]);
			
			//Dump previous root?
			
			console.log(">>> Tree.add finished, new root is " + this.rootHash);
		}
	}
	
	diff(other) {
		
		var newElements = new Set();
		
		//experimental function, returns a set of element hashes
		// that is present in the other tree but not on this one
		
		return newElements;
	}
};