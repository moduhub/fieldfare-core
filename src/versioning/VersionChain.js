/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Chunk } from '../chunking/Chunk.js';
import { Collection } from '../structures/Collection.js';
import { VersionStatement } from '../versioning/VersionStatement.js';
import chalk from 'chalk';

export class VersionChain {

    constructor(head, owner, maxDepth) {
        this.base = '';
        this.head = head;
        this.owner = owner;
        this.maxDepth = maxDepth;
        this.includeBase = true;
    }

    static async findCommonVersion(chainA, chainB) {
        var depthA = 0;
        for await (const versionA of chainA.versionsIterator()) {
            var depthB = 0;
            for await (const versionB of chainB.versionsIterator()) {
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

    async toArray() {
        const array = [];
        for await (const change of this.changesIterator()) {
            array.push(change);
        }
        return array.reverse();
    }

    async* changesIterator() {
        for await (const {version, collection} of this.versionsIterator()) {
            const statement = await collection.getElement('version');
            if(statement) {
                const changes = await Chunk.fromIdentifier(statement.data.changes).expand(0);
                for(const descriptor of changes) {
                    yield {issuer: statement.source, descriptor};
                }
            }
        }
    }

	async* versionsIterator() {
        if(this.head !== '') {
            const iCollection = new Collection();
            iCollection.setState(this.head);
            yield {version:this.head, collection:iCollection};
            let iVersionStatement = await iCollection.getElement('version');
            let prevVersion = iVersionStatement?.data.prev;
            while (prevVersion && prevVersion !== this.base) {
                iCollection.setState(prevVersion);
                yield {version: prevVersion, collection: iCollection};
                iVersionStatement = await iCollection.getElement('version');
                prevVersion = iVersionStatement?.data.prev;
            }
            if(this.includeBase === true
            && this.base !== ''
            && this.base !== this.head) {
                yield {version: this.base, collection: iCollection};
            }
        }
    }

    async prettyPrint(mergeDepth=0, callback) {
        if(callback === undefined) {
            callback = console.log;
        }
        for await (const {issuer, descriptor} of this.changesIterator()) {
            let line;
            let prepend = '';
            for(var i=0; i<mergeDepth; i++) {
                prepend += ' |';
            }
            if(descriptor.method === 'merge') {
                const mergeChain = new VersionChain(params.head, issuer, 50);
                mergeChain.limit(params.base);
                mergeChain.prettyPrint(mergeDepth+1);
            } else {
                line = chalk.bold.bgWhite.blue(' ' + descriptor.method + ' ')
                    + ' from \'' + issuer
                    + '\'\n'+ JSON.stringify(descriptor.params, null, 2);
                line.replace('\n', prepend + '\n');
                callback(line);
            }
        }
    }

};
