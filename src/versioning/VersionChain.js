
const VersionStatement = require('./VersionStatement.js');

class ChangesIterator {

    constructor() {
        this.keys = []
    }

    static async from(chain) {
        var iterator = new ChangesIterator;
        iterator.chain = chain;
        for await(const [version, statement] of chain) {
            iterator.keys.push(statement.data.changes);
        }
        iterator.keys.reverse();
        return iterator;
    }

    async* [Symbol.asyncIterator]() {

        for(const key of this.keys) {
            const changes = await host.getResourceObject(key, this.chain.owner);
            console.log("Changes contents: " + JSON.stringify(changes));
			for(const prop in changes) {
				const value = changes[prop];
				console.log("Apply method: " + prop
                + ' with params: ' + JSON.stringify(value));
                yield [prop, value]; //method:params format
            }
        }
    }
}

module.exports = class VersionChain {

    constructor(head, owner, maxDepth) {

        this.base = '';
        this.head = head;
        this.owner = owner;
        this.maxDepth = maxDepth;

    }

	getChanges() {
		return ChangesIterator.from(this);
	}

	async* [Symbol.asyncIterator]() {

        if(this.head !== '') {

            var iVersion = this.head;

            while (iVersion !== this.base) {
                const iUpdateMessage = await VersionStatement.fromResource(iVersion, this.owner);
                yield [iVersion, iUpdateMessage];
                iVersion = iUpdateMessage.data.prev;
            }

            if(this.base !== '') {
                //include base statement
                const iUpdateMessage = await VersionStatement.fromResource(this.base, this.owner);
                yield [this.base, iUpdateMessage];
            }
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
