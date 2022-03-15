/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


const HashLinkedTree = require('../src/structures/HashLinkedTree.js');
const HostManager = require('../src/HostManager.js');
const ResourcesManager = require('../src/ResourcesManager.js');

global.host = new HostManager();

//Note: On node it is necessary to provide the correct webcrypto implementation
global.crypto = require('crypto').webcrypto;

host.addResourcesManager(new ResourcesManager());

var tree = new HashLinkedTree(4);

var obj1 = {
	name:'foo',
	data:'test'
};

var obj2 = {
	name:'bar',
	data:'best'
};

var obj3 = {
	name:'boo',
	data:'task'
}

var obj4 = {
	name:'far',
	data:'mask'
}

tree.add(obj1);
tree.add(obj2);
tree.add(obj3);
tree.add(obj4);