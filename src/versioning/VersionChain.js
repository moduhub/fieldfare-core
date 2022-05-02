
const VersionStatement = require('./VersionStatement.js');

module.exports = class VersionChain {

    constructor(head, owner, maxDepth) {

        this.base = '';
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
        } while(iVersion != this.base);

        if(iVersion != '') {
            //include base statement
            const iUpdateMessage = await VersionStatement.fromResource(iVersion, this.owner);
            yield [iVersion, iUpdateMessage];
        }

    }

    static async findCommonVersion(chainA, chainB) {

        var depthA = 0;

        for await (const [versionA, statementA] of chainA) {

            var depthB = 0;

            for await (const [versionB, statementB] of chainB) {

                console.log("A("+depthA+"): " + versionA);
                console.log("B("+depthB+"): " + versionB);

                if(versionA === versionB) {
                    return versionA;
                }
                if(++depthB > chainB.maxDepth) throw 'chain B depth exceeded';

            }

            if(++depthA > chainA.maxDepth) throw 'chain A depth exceeded';
        }

        throw 'chains not coincident';
    }

    limit(base) {
        this.base = base;
        return this;
    }

    async length(prevVersion) {
        var count = 0;

        if(prevVersion === undefined) prevVersion = this.base;

        if(this.head !== prevVersion) {

            //console.log("this.head: " + this.head + " prevVersion: " + prevVersion);

            for await(const [version, statement] of this) {

                //console.log("iversion: " + version);

                if(++count>this.maxDepth) throw 'max depth exceeded';

                if(version == prevVersion) {
                    return count;
                }
            }
            throw 'prev version not in chain';
        }
        return count;
    }

};
