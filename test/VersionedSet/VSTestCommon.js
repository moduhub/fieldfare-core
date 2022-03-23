/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


const HostManager = require('../../src/HostManager.js');
const ResourcesManager = require('../../src/ResourcesManager.js');

module.exports = {
	
	testHostsIDs: [
		"P9q2XHwBvYvxaBNNol3PQPK1C/QCvsI1Wxwx4nsYTDo=",
		"ZBtzCpE//A/HP1BZR4sL1n9bAkvUdRrWMfVfvPl/UGA="
	],
	
	async init(privateKeyData) {

		global.host = new HostManager();

		//Note: On node it is necessary to provide the correct webcrypto implementation
		global.crypto = require('crypto').webcrypto;

		host.addResourcesManager(new ResourcesManager());

		await host.setupId(privateKeyData);

	}
}