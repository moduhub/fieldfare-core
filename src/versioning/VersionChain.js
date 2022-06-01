
import {VersionStatement} from '../versioning/VersionStatement';
import {logger} from '../basic/Log';
import chalk from 'chalk';

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

        //logger.log('info', 'ChangesIterator enter, num keys: ' + numKeys);

        for(var i=0; i<numKeys; i++) {

            const key = this.keys[i];
            const issuer = this.issuers[i];

            //logger.log('info', 'Iteration ' + i + '>  key:' + key + ' issuer: ' + issuer);

            const changes = await host.getResourceObject(key, this.chain.owner);

			for(const prop in changes) {
				const value = changes[prop];

                // logger.log('info', "Apply method: " + prop
                // + ' from issuer: ' + issuer);
                // + ' with params: ' + JSON.stringify(value)

                yield [issuer, prop, value]; //issuer:method:params format
            }
        }
    }
}

export class VersionChain {

    constructor(head, owner, maxDepth) {

        this.base = '';
        this.head = head;
        this.owner = owner;
        this.maxDepth = maxDepth;
        this.includeBase = true;

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

            if(this.includeBase === true
            && this.base !== '') {
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

                // logger.log('info', "A("+depthA+"): " + versionA);
                // logger.log('info', "B("+depthB+"): " + versionB);

                if(versionA === versionB) {
                    return versionA;
                }
                if(++depthB > chainB.maxDepth) throw Error('chain B depth exceeded');

            }

            if(++depthA > chainA.maxDepth) throw Error('chain A depth exceeded');
        }

        throw Error('chains not coincident');
    }

    limit(base, include) {
        this.base = base;
        if(include === true
        || include === false)  {
            this.includeBase = include;
        }
        return this;
    }

    async length(prevVersion) {
        var count = 0;

        if(prevVersion === undefined) prevVersion = this.base;

        if(this.head !== prevVersion) {

            //logger.log('info', "this.head: " + this.head + " prevVersion: " + prevVersion);

            for await(const [version, statement] of this) {

                //logger.log('info', "iversion: " + version);

                if(++count>this.maxDepth) throw Error('max depth exceeded');

                if(version == prevVersion) {
                    return count;
                }

                if(this.includeBase === false
                && statement.data.prev === prevVersion) {
                    return count;
                }

            }

            throw Error('prev version not in chain');
        }
        return count;
    }

    async print(mergeDepth=0) {

        const localChanges = await this.getChanges();

        for await (const [issuer, method, params] of localChanges) {

            var string;
            var prepend = '';

            for(var i=0; i<mergeDepth; i++) {
                prepend += ' |';
            }

            if(method === 'merge') {
                const mergeChain = new VersionChain(params.head, issuer, 50);
                mergeChain.limit(params.base);
                mergeChain.print(mergeDepth+1);
            } else {
                string = 'method: ' + chalk.red(method)
                    + ' issuer:\"' + issuer
                    + ' \n params: '+ JSON.stringify(params, null, 2);

                string.replace('\n', prepend + '\n');
                console.log(string);
            }

        }
    }

};
