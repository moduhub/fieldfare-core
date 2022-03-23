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
		d: "rGmfJ-2F61qtY1YICCgpNOmYbW91oye8xLfwbIdtvPo",
		use: "sig",
		crv: "P-256",
		kid: "FTYrbkxa0DojHG5B9MUv9R8Huq1TUCYv8_YTLOU2dcc",
		x: "w7lfpim92nPPGIyNb7viuahjycpHQ2YcL_vWko4cykQ",
		y: "IJVWM43TdVDgQJV4ZwqwzvF5rH0n6UY37ROzoU_M0Jc",
		alg: "ES256"
	});
	
	//Load set from host1
	
	var set = new VersionedSet('');

	
}

runTest();