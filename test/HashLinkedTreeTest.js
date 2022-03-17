/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


const HashLinkedTree = require('../src/structures/HashLinkedTree.js');
const HostManager = require('../src/HostManager.js');
const ResourcesManager = require('../src/ResourcesManager.js');

const gSalt = 'hlt';

async function initHost() {

	global.host = new HostManager();

	//Note: On node it is necessary to provide the correct webcrypto implementation
	global.crypto = require('crypto').webcrypto;

	host.addResourcesManager(new ResourcesManager());

}

async function HLT_test(order, numElements, numChecks) {

	var tree = new HashLinkedTree(order);

	//Build tree
	for(var i=0;i<numElements; i++) {
		
		var iObj = {
			index: i,
			salt: gSalt
		};
	
		await tree.add(iObj);
		
		if(await tree.has(iObj) == false) {
			throw 'has() after add() failed at index ' + i;
		}
	}
	
	//Validate inserted elements
	for(var i=0;i<numElements; i++) {
		
		var iObj = {
			index: i,
			salt: gSalt
		};
		
		if(await tree.has(iObj) == false) {
			throw 'has(valid) failed at index ' + i;
		}		
	}
	
	//Validate nonexistant elements
	for(var i=0;i<numChecks; i++) {
		
		var iObj = {
			index: i+numElements,
			salt: gSalt
		};
		
		if(await tree.has(iObj) == true) {
			throw 'has(invalid) failed at index ' + i;
		}
	}
}

initHost();

HLT_test(4, 20, 5);