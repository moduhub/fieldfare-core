/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


const HashLinkedTree = require('../src/structures/HashLinkedTree.js');
const HostManager = require('../src/HostManager.js');
const ResourcesManager = require('../src/ResourcesManager.js');

async function initHost() {

	global.host = new HostManager();

	//Note: On node it is necessary to provide the correct webcrypto implementation
	global.crypto = require('crypto').webcrypto;

	host.addResourcesManager(new ResourcesManager());

}

async function initTree() {

	var tree = new HashLinkedTree(4);

	var obj1 = {
		index: 1,
		name:'foo',
		data:'test'
	};

	var obj2 = {
		index: 2,
		name:'bar',
		data:'best'
	};

	var obj3 = {
		index: 3,
		name:'boo',
		data:'task'
	}

	var obj4 = {
		index: 4,
		name:'far',
		data:'mask'
	}

	var obj5 = {
		index: 5,
		name:'raf',
		data:'fish'
	}

	await tree.add(obj1);
	await tree.add(obj2);
	await tree.add(obj3);
	await tree.add(obj4);
	await tree.add(obj5);

}

initHost();

initTree();