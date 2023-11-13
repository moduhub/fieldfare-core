/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Chunk } from '../chunking/Chunk.js';
import { Collection } from '../structures/Collection.js';
import { VersionStatement } from '../versioning/VersionStatement.js';
import { logger } from '../basic/Log.js';

export class VersionChain {

    constructor(head, owner, maxDepth=100) {
        this.base = '';
        this.head = head;
        this.owner = owner;
        this.maxDepth = maxDepth;
        this.includeBase = true;
    }

/**
 * Finds the common version between two chains of versions.
 * @static
 * @async
 * @param {VersionChain} chainA - The first chain of versions.
 * @param {VersionChain} chainB - The second chain of versions.
 * @throws {Error} If the depth of either chain exceeds the maximum depth allowed or if the chains are not coincident.
 * @returns {Promise<{version: string, depthA: number, depthB: number}>} An object containing the common version and the depth of the version in each chain.
 */
static async findCommonVersion(chainA, chainB) {
    var depthA = 0;
    for await (const {version:versionA} of chainA.versionsIterator()) {
        var depthB = 0;
        for await (const {version:versionB} of chainB.versionsIterator()) {
            if(versionA === versionB) {
                return {version: versionA, depthA, depthB};
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

    async length(limitVersion) {
        var count = 0;
        if(limitVersion === undefined) limitVersion = this.base;
        if(this.head !== limitVersion) {
            for await(const {version, collection} of this.versionsIterator()) {
                if(++count>this.maxDepth) throw Error('max depth exceeded');
                // console.log('version: ' + version + ' x limit: ' + limitVersion);
                if(version == limitVersion) {
                    return count;
                }
                if(this.includeBase === false) {
                    const statement = await collection.getElement('version');
                    const prevVersion = statement.data.prev;
                    if(prevVersion == limitVersion) {
                        return count;
                    }
                }
            }
            throw Error('prev version not in chain');
        }
        return count;
    }

    async getChangesArray() {
        const array = [];
        for await (const change of this.changesIterator()) {
            array.push(change);
        }
        return array.reverse();
    }

    async getStatementsArray() {
        const array = [];
        for await (const {statement} of this.versionsIterator()) {
            array.push(statement);
        }
        return array.reverse();
    }

    async* changesIterator() {
        for await (const {statement} of this.versionsIterator()) {
            if(statement) {
                const changes = await Chunk.fromIdentifier(statement.data.changes, statement.source).expand(0);
                for(const descriptor of changes) {
                    yield {issuer: statement.source, descriptor};
                }
            }
        }
    }

	async* versionsIterator() {
        let iVersion = this.head;
        const iCollection = new Collection(undefined, this.owner);
        while( iVersion
            && iVersion !== ''
            && iVersion !== this.base) {
            await iCollection.setState(iVersion);
            const iVersionStatement = await iCollection.getElement('version');
            yield {
                version: iVersion,
                collection: iCollection,
                statement: iVersionStatement
            };
            iVersion = iVersionStatement?.data.prev;
        }
        if(this.includeBase === true
        && this.base !== ''
        && this.base !== this.head) {
            iCollection.setState(this.base);
            const iVersionStatement = await iCollection.getElement('version');
            yield {
                version: this.base,
                collection: iCollection,
                statement: iVersionStatement
            };
        }
    }

    async prettyPrint(callback, mergeDepth=0) {
        if(callback === undefined) {
            callback = console.log;
        }
        for await (const {issuer, descriptor} of this.changesIterator()) {
            let line;
            let prepend = '';
            for(var i=0; i<mergeDepth; i++) {
                prepend += '| ';
            }
            if(descriptor.method === 'merge') {
                callback(prepend + 'o Merge from \'' + issuer + '\'');
                const mergeChain = new VersionChain(descriptor.params[1], issuer, 50);
                mergeChain.limit(descriptor.params[0], false);
                await mergeChain.prettyPrint(callback, mergeDepth+1);
            } else {
                line = prepend + descriptor.method + ' '
                    + ' from \'' + issuer
                    + '\'\n'+ JSON.stringify(descriptor.params, null, 2);
                callback(line.replace(/(?:\r\n|\r|\n)/g, '\n' + prepend));
            }
        }
    }

};
