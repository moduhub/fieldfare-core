/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const common = require("./VSTestCommon.js");

const VersionedSet = require('../../src/structures/VersionedSet.js');

const gSalt = 'hlt';

async function runTest() {
	
	await common.init({
		kty: "EC",
		d: "eEWiWMmT540u44M28QjU03uzzRLRQ0_ixtzc0ztQ3os",
		use: "sig",
		crv: "P-256",
		kid: "DDEebnv1ihLpOyB90qUXnxcEO7NYnIcaCrtHzhzJr7U",
		x: "hj_7IO73w-q5Hp9LTfZWemQbZDSadWBidx8kFTTakXQ",
		y: "exthGwwzjgQyIIa7ZmgWQH62OloYGnCekh-f8bFgG80",
		alg: "ES256"
	});
		
	var set = new VersionedSet('');
	
	for await (const id of common.testHostsIDs) {
	
		await set.addAdmin(id);
		
	}
	
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
	
	await set.addElement(obj1);
	
	console.log("Adding obj2: " + JSON.stringify(obj2, null, 2)
	+ "->" + await host.generateResourceHash(obj2));

	await set.addElement(obj2);
	
}

runTest();