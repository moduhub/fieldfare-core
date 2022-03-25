/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const HashLinkedTree = require('./HashLinkedTree.js');

const VersionedData = require('./VersionedData.js');

module.exports = class VersionedSet extends VersionedData {
	
	constructor() {
		super();
		
		this.elements = new HashLinkedTree(5);
		
	}
	
	async addElement(newElement) {

		const newElementHash = await host.generateResourceHash(newElement);

		console.log("Adding new element: " + newElementHash);
		
		//Check if element was not already present
		if(await this.elements.has(newElementHash)) {
			
			console.log("addElement failed: hash already in set");
			
		} else {
		
			//Perform local changes
			this.version = await this.elements.add(newElement);

			await this.commit({
				addElement: newElementHash
			});
		}
		
	}
	
	//Validate changes in a chain
	// accept or reject changes
	async apply(change, newVersion) {

		//Validate change structure
		
		console.log("Applying chage: " + JSON.stringify(change, null, 2)
			+ " to target version " + newVersion);
		
		var newTree = Object.assign(new HashLinkedTree, this.elements);
		
		if('addElement' in change) {
			
			await newTree.add(change.addElement);
			
		}

		if(newTree.rootHash === newVersion) {
			this.elements = newTree;
		}
	}

};