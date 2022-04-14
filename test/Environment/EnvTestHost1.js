/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


const common = require('./EnvTestCommon.js');

const Environment = require('../../src/Environment.js');


async function test() {

	await common.init(common.privateKeys[0], 15000);

	//Attemp to fetch latest version of environment
	var env = new Environment();

	await env.init('25b1d0c4-6f12-4a27-bd27-da1b297221d1');

	await env.addAdmin(host.id);				//me
	await env.addAdmin(common.testHostsIDs[1]);	//other

	await env.addProvider('resource', common.testHostsIDs[0]);
	await env.addProvider('resource', common.testHostsIDs[1]);

	console.log("Current env version is " + env.version);

}

test();
