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
	
	updateMsgs: [
		{
			"source": "ZBtzCpE//A/HP1BZR4sL1n9bAkvUdRrWMfVfvPl/UGA=",
			"data": {
				"admins": "qwU0yljBBKf+y30yDbFwWWlK79Vw1MlqKZbLrQQzRz4=",
				"elements": "",
				"changes": {
					"addAdmin": "P9q2XHwBvYvxaBNNol3PQPK1C/QCvsI1Wxwx4nsYTDo="
				}
			},
			"signature": "oA+8a6FZQUZIeGVXoLkj8yNnSPkWnvw2QL/4I+o2cfigv2D1LRt1qPUODkN5KW3guXvzMbrDlN6tDHlPlfUeyQ=="
		},
		{
			"source": "ZBtzCpE//A/HP1BZR4sL1n9bAkvUdRrWMfVfvPl/UGA=",
				"data": {
					"prev": "/EqKyind56SfofVlnXbttXGeCVsTjR8rTLdwOkp458I=",
					"admins": "6Hzr3tssLJ1AIxeIp82C7aTYL7cLDnFOTCIWbYuD1MQ=",
					"elements": "",
					"changes": {
						"addAdmin": "ZBtzCpE//A/HP1BZR4sL1n9bAkvUdRrWMfVfvPl/UGA="
					}
				},
				"signature": "PsRXIzLlbeB5MMiN+JWBtMze+WTaCLSmV1z/Y890l5DbTqGX3SsMR3I5g4FHH7CwZt69u0B5Knv5pTKbEwwaTg=="
		}
	],
	
	async init(privateKeyData) {

		global.host = new HostManager();

		//Note: On node it is necessary to provide the correct webcrypto implementation
		global.crypto = require('crypto').webcrypto;

		host.addResourcesManager(new ResourcesManager());

		await host.setupId(privateKeyData);

	}
}