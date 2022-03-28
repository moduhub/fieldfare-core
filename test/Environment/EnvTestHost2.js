/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


const common = require('./EnvTestCommon.js');

const Environment = require('../../src/Environment.js');


async function test() {
	
	await common.init(common.privateKeys[1], 15001);
	
	//Attemp to fetch latest version of environment
	var env = new Environment();
	
	await env.init('25b1d0c4-6f12-4a27-bd27-da1b297221d1');
	
	//Reach for host 2, attemp to sync the env with him
	var forcedUDPChannel = common.udpTransceiver.newChannel('127.0.0.1', '15000');

	host.bootChannel(forcedUDPChannel);
	
}

test();