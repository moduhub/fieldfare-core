/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const VersionedSet = require('../src/structures/VersionedSet.js');

const HostManager = require('../src/HostManager.js');
const ResourcesManager = require('../src/ResourcesManager.js');

const gSalt = 'hlt';

async function initHost() {

	global.host = new HostManager();

	//Note: On node it is necessary to provide the correct webcrypto implementation
	global.crypto = require('crypto').webcrypto;

	host.addResourcesManager(new ResourcesManager());

}

async function VS_test() {
	
	var set = new VersionedSet('');
	
	var obj1 = {
		index: 1,
		salt: gSalt
	};
	
	await set.add(obj1);
	
}

initHost();

VS_test();