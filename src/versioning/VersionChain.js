import { Chunk } from '../chunking/Chunk';
import { VersionStatement } from '../versioning/VersionStatement';
import { logger } from '../basic/Log';
import chalk from 'chalk';

/**
 * The ChangesIterator allows fecthing the changes inside a VersionChain
 * in order, along with the issuer of each change.
 */
class ChangesIterator {

    constructor() {
        this.issuers = [];
        this.chunks = [];
    }

    static async from(chain) {
        var iterator = new ChangesIterator;
        iterator.chain = chain;
        for await(const [version, statement] of chain) {
            iterator.chunks.push(statement.data.changes);
            iterator.issuers.push(statement.source);
        }
        iterator.chunks.reverse();
        iterator.issuers.reverse();
        return iterator;
    }

    async* [Symbol.asyncIterator]() {

        const numChunks = this.chunks.length;

        //logger.log('info', 'ChangesIterator enter, num changes: ' + numChunks);

        for(var i=0; i<numChunks; i++) {

            const chunk = this.chunks[i];
            const issuer = this.issuers[i];

            //logger.log('info', 'Iteration ' + i + '>  identifier:' + identifier + ' issuer: ' + issuer);

            const changes = await chunk.expand();

			for(const prop in changes) {
				const value = changes[prop];

                // logger.log('info', "Apply method: " + prop
                // + ' from issuer: ' + issuer);
                // + ' with params: ' + JSON.stringify(value)

                yield {
                    issuer: issuer,
                    method: prop,
                    params: value
                };
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

    async getHeadDescriptor() {
        if(this.headDescriptor === undefined) {
            if(this.head === '') {
                return '';
            }
            const headStatementChunk = Chunk.fromIdentifier(this.head, this.owner);
            const headStatement = await VersionStatement.fromDescriptor(headStatementChunk);
            this.headDescriptor = headStatement.data.elements;
            return this.headDescriptor;
        }
        return this.headDescriptor;
    }

	async* [Symbol.asyncIterator]() {
        if(this.head !== '') {
            var iVersionChunk = Chunk.fromIdentifier(this.head);
            while (iVersionChunk
                && iVersionChunk.id !== this.base) {
                const iVersionStatement = await VersionStatement.fromDescriptor(iVersionChunk);
                yield [iVersionChunk.id, iVersionStatement];
                iVersionChunk = iVersionStatement.data.prev;
            }
            if(this.includeBase === true
            && this.base !== '') {
                //include base statement
                const iVersionChunk = Chunk.fromIdentifier(this.base);
                const iVersionStatement = await VersionStatement.fromDescriptor(iVersionChunk);
                yield [this.base, iVersionStatement];
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
            for await(const [version, statement] of this) {
                if(++count>this.maxDepth) throw Error('max depth exceeded');
                if(version == prevVersion) {
                    return count;
                }
                if(this.includeBase === false
                && statement.data.prev.id === prevVersion) {
                    return count;
                }
            }
            throw Error('prev version not in chain');
        }
        return count;
    }

    async print(mergeDepth=0) {
        console.log('Head version identifier: \'' + this.head + '\'');
        const localChanges = await this.getChanges();
        for await (const change of localChanges) {
            var string;
            var prepend = '';
            for(var i=0; i<mergeDepth; i++) {
                prepend += ' |';
            }
            if(change.method === 'merge') {
                const mergeChain = new VersionChain(params.head, change.issuer, 50);
                mergeChain.limit(params.base);
                mergeChain.print(mergeDepth+1);
            } else {
                string = chalk.bold.bgWhite.blue(' ' + change.method + ' ')
                    + ' from \'' + change.issuer
                    + '\'\n'+ JSON.stringify(change.params, null, 2);
                string.replace('\n', prepend + '\n');
                console.log(string);
            }
        }
    }

};
