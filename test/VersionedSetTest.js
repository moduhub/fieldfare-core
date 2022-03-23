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

	var privateKeyData = {
		kty: "EC",
		d: "rGmfJ-2F61qtY1YICCgpNOmYbW91oye8xLfwbIdtvPo",
		use: "sig",
		crv: "P-256",
		kid: "FTYrbkxa0DojHG5B9MUv9R8Huq1TUCYv8_YTLOU2dcc",
		x: "w7lfpim92nPPGIyNb7viuahjycpHQ2YcL_vWko4cykQ",
		y: "IJVWM43TdVDgQJV4ZwqwzvF5rH0n6UY37ROzoU_M0Jc",
		alg: "ES256"
	};

	global.host = new HostManager();

	//Note: On node it is necessary to provide the correct webcrypto implementation
	global.crypto = require('crypto').webcrypto;

	host.addResourcesManager(new ResourcesManager());
	
	await host.setupId(privateKeyData);

}

async function VS_test() {
	
	await initHost();
	
	var set = new VersionedSet('');
	
	var obj1 = {
		index: 1,
		salt: gSalt
	};
	
	var obj2 = {
		index: 2,
		salt: gSalt
	};
	
	console.log("Adding obj1: " + JSON.stringify(obj1, null, 2)
		+ "->" + await host.generateResourceHash(obj1));
	
	await set.add(obj1);
	
	console.log("Adding obj2: " + JSON.stringify(obj2, null, 2)
	+ "->" + await host.generateResourceHash(obj2));

	await set.add(obj2);
}

VS_test();