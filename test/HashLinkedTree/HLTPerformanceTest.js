
const common = require('./HLTTestCommon.js');

const HashLinkedTree = require('../../src/structures/HashLinkedTree.js');

const gSalt = 'hlttest';

async function test() {

	await common.init(common.privateKeys[0]);

    var hlt = new HashLinkedTree(5);

    //populate
    for(var i=0; i<1000; i++) {
        iObj = {
            index: i,
            salt: gSalt
        };

        await hlt.add(iObj);
    }

    var starttime = performance.now();

    //Async iterator method
    for await(const object of hlt) {
        console.log(JSON.stringify(object));
    }

    var endtime = performance.now();

    console.log("Total iteration time: " + (endtime-starttime) + " ms");

}

test();
