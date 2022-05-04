
const VersionStatement = require('./VersionStatement.js');

class ChangesIterator {

    constructor() {
        this.issuers = [];
        this.keys = []
    }

    static async from(chain) {
        var iterator = new ChangesIterator;
        iterator.chain = chain;
        for await(const [version, statement] of chain) {
            iterator.keys.push(statement.data.changes);
            iterator.issuers.push(statement.source);
        }
        iterator.keys.reverse();
        iterator.issuers.reverse();
        return iterator;
    }

    async* [Symbol.asyncIterator]() {

        const numKeys = this.keys.length;

        //console.log('ChangesIterator enter, num keys: ' + numKeys);

        for(var i=0; i<numKeys; i++) {

            const key = this.keys[i];
            const issuer = this.issuers[i];

            //console.log('Iteration ' + i + '>  key:' + key + ' issuer: ' + issuer);

            const changes = await host.getResourceObject(key, this.chain.owner);

			for(const prop in changes) {
				const value = changes[prop];

                console.log("Apply method: " + prop
                + ' from issuer: ' + issuer);
                + ' with params: ' + JSON.stringify(value)

                yield [issuer, prop, value]; //issuer:method:params format
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

    async getHeadState() {

        if(this.headState === undefined) {

            if(this.head === '') {
                return '';
            }

            const headStatement = await VersionStatement.fromResource(this.head, this.owner);
            this.headState = headStatement.data.state;
            return this.headState;

        }

        return this.headState;
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
