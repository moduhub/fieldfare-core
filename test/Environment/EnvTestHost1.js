/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


const common = require('./EnvTestCommon.js');

async function test() {
	
	await common.init(common.privateKey[0]);
	
	//Attemp to fetch latest version of environment
	var env = new Environment('25b1d0c4-6f12-4a27-bd27-da1b297221d1');
	
	await env.init();
}

test();