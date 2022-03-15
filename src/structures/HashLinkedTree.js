/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Utils = require('../Utils.js');

class TreeContainer {
	
	constructor() {
		this.elements = new Array();
		this.children = new Array();
		
		this.children[0] = '';
		this.numElements = 0;
	}
	
	addElement(hash, rightChild) {
	
		if(rightChild === null
		|| rightChild === undefined) {
			throw 'addElement missing parameter';
		}
	
		if(Utils.isBase64(hash) === false) {
			throw 'invalid element hash';
		}

//		if(rightChild instanceof String === false
//		&& typeof rightChild !== 'string') {
//			throw 'invalid right child - not a string';
//		}
		
		if(rightChild !== ''
		&& Utils.isBase64(hash) === false) {
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
	// 1) mean element is popped out
	// 2) left element stays
	// 3) right element is returned
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
	
	constructor(degree) {
		
		if(degree <= 0
		|| degree > 10
		|| degree === undefined
		|| degree === null) {
			throw 'invalid tree order value';
		}
		
		this.degree = degree;
		
		this.root = new TreeContainer();
		
	}
	
	async add(element) {
		
		console.log("tree.add(" + JSON.stringify(element) + ")");
		
		var elementHash = await host.storeResourceObject(element);
		
		var prevBranchHashes = new Array();
		var branch = new Array();
		
		console.log("elementHash: " + elementHash);
		
		var iContainer = this.root;
		
		prevBranchHashes[0] = '';//root hash
		branch[0] = iContainer;
		
		var nextContainerHash = iContainer.follow(elementHash);
		
		//Get to last container
		while(nextContainerHash !== '') {

			iContainer = await host.getResourceObject(nextContainerHash);

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
		
		iContainer.addElement(elementHash, '');
		
		console.log("Container updated: "  + JSON.stringify(iContainer));
		
		//Perform split if numElements == degree
		if(iContainer.numElements == this.degree) {
			
			console.log("SPLIT!");
			
			var rightContainer = new TreeContainer();
			
			var meanElement = iContainer.split(rightContainer);
		
			console.log("Mean element: " + meanElement);
			console.log("Left: "  + JSON.stringify(iContainer));
			console.log("Right: "  + JSON.stringify(rightContainer));
			
		}

		//Update branch down (up?) to root
		for(var i=branch.size; i>0; i--) {
			
			const current = host.storeResourceObject(branch[i]);
			
			container.updateChild(prevBranchHashes[i], current);
			
			//Free previous resource?
			
		}

	}
	
	diff(other) {
		
		var newElements = new Set();
		
		//experimental function, returns a set of element hashes
		// that is present in the other tree but not on this one
		
		return newElements;
	}
};