
const HostManager = require('../../src/HostManager.js');

const LevelResourcesManager = require('../../src/resources/LevelResourcesManager.js');

const LevelNVData = require('../../src/nvd/LevelNVData.js');

module.exports = {

    privateKeys: [
		{
			kty: "EC",
			d: "eEWiWMmT540u44M28QjU03uzzRLRQ0_ixtzc0ztQ3os",
			use: "sig",
			crv: "P-256",
			kid: "DDEebnv1ihLpOyB90qUXnxcEO7NYnIcaCrtHzhzJr7U",
			x: "hj_7IO73w-q5Hp9LTfZWemQbZDSadWBidx8kFTTakXQ",
			y: "exthGwwzjgQyIIa7ZmgWQH62OloYGnCekh-f8bFgG80",
			alg: "ES256"
		},
		{
			kty: "EC",
			d: "rGmfJ-2F61qtY1YICCgpNOmYbW91oye8xLfwbIdtvPo",
			use: "sig",
			crv: "P-256",
			kid: "FTYrbkxa0DojHG5B9MUv9R8Huq1TUCYv8_YTLOU2dcc",
			x: "w7lfpim92nPPGIyNb7viuahjycpHQ2YcL_vWko4cykQ",
			y: "IJVWM43TdVDgQJV4ZwqwzvF5rH0n6UY37ROzoU_M0Jc",
			alg: "ES256"
		}
	],

	testHostsIDs: [
		"ZBtzCpE//A/HP1BZR4sL1n9bAkvUdRrWMfVfvPl/UGA=",
		"P9q2XHwBvYvxaBNNol3PQPK1C/QCvsI1Wxwx4nsYTDo="
	],

	async init(privateKeyData) {

		global.host = new HostManager();

		//Note: On node it is necessary to provide the correct webcrypto implementation
		global.crypto = require('crypto').webcrypto;

        global.nvd = new LevelNVData();

		host.addResourcesManager(new LevelResourcesManager());

		await host.setupId(privateKeyData);

	}
}
