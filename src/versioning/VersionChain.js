
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
            yield iUpdateMessage;
            iVersion = iUpdateMessage.data.prev;
        } while(iVersion != '');
    }

    static async findCommonVersion(chainA, chainB) {
        var depthA = 0;
        for await (const statementA of chainA) {
            var depthB = 0;
            for await (const statementB of chainB) {
                console.log("A("+depthA+"): " + statementA.data.prev);
                console.log("B("+depthB+"): " + statementB.data.prev);
                if(statementA.data.prev === statementB.data.prev) {
                    return statementA.data.prev;
                }
                if(++depthB > chainB.maxDepth) throw 'chain B depth exceeded';
            }
            if(++depthA > chainA.maxDepth) throw 'chain A depth exceeded';
        }

        throw 'verions chains not coincident';
    }

    async length(version) {
        var count = 0;
        if(this.version !== version) {
            for await(const statement of this) {
                if(++count>this.maxDepth) throw 'max depth exceeded';
                if(statement.prev === version) break;
            }
        }
        return count;
    }

    async getStatementChain(version) {

		var iUpdateMessage = await VersionStatement.fromResource(this.head, this.owner);
		var depth = 0;
		var chain = new Array();

		do {

			await VersionStatement.validate(iUpdateMessage);

			const prevHash = iUpdateMessage.data.prev;
			const currentSource = iUpdateMessage.source;

			if(prevHash === '') {
				//Found chain origin without any match
				throw 'version msg not in chain';
			}

			//Attemp to get last update from same source
			iUpdateMessage = await VersionStatement.fromResource(prevHash, this.owner);

			if(++depth>maxDepth) {
				throw 'build chain failed: max depth reached';
			}

			chain.push(iUpdateMessage);

		} while(iUpdateMessage.data.prev !== version);

		return chain;
	}

};
