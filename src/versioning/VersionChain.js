
const VersionStatement = require('./VersionStatement.js');

module.exports = class VersionChain {

    constructor(head, owner, maxDepth) {

        this.head = head;
        this.owner = owner;
        this.maxDepth = maxDepth;

    }

	async* [Symbol.asyncIterator]() {
        var iVersion = this.head;
        do {
            const iUpdateMessage = await VersionStatement.fromResource(iVersion, this.owner);
            yield [iVersion, iUpdateMessage];
            iVersion = iUpdateMessage.data.prev;
        } while(iVersion != '');
    }

    static async findCommonVersion(chainA, chainB) {

        var depthA = 0;

        for await (const [versionA, statementA] of chainA) {

            var depthB = 0;

            for await (const [versionB, statementB] of chainB) {

                console.log("A("+depthA+"): " + versionA);
                console.log("B("+depthB+"): " + versionB);

                if(versionA === ''
                || versionB === '') {
                    throw 'chains not coincident';
                }

                if(versionA === versionB) {
                    return versionA;
                }
                if(++depthB > chainB.maxDepth) throw 'chain B depth exceeded';

            }

            if(++depthA > chainA.maxDepth) throw 'chain A depth exceeded';
        }

        throw 'corrupted chain structure';
    }

    async length(base) {
        var count = 0;
        if(this.head !== base) {
            console.log("this.head: " + this.head + " base: " + base);
            for await(const [version, statement] of this) {
                if(++count>this.maxDepth) throw 'max depth exceeded';
                if(version === base) break;
            }
        }
        return count;
    }

};
