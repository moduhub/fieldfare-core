/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { ChunkManager } from './ChunkManager.js';
import { ChunkingUtils } from './CommonExports.js';
import { logger } from '../basic/Log.js';

const { Level } = require('level');

export class LevelChunkManager extends ChunkManager {

    constructor() {
        super();
        this.db = new Level('chunk', { valueEncoding: 'json' })
        setInterval(async () => {
            logger.log('info', await this.report());
        }, 10000);
    }

    async report() {
        var starttime = performance.now();
        const iterator = this.db.keys();
        var numEntries = 0;
        for await (const key of iterator) numEntries++;
        var endtime = performance.now();
        var deltaReport = "";
        if(this.lastNumEntries !== undefined) {
            deltaReport = ", "
            if(numEntries >= this.lastNumEntries) {
                deltaReport += (numEntries - this.lastNumEntries) + " more "
            } else {
                deltaReport += (this.lastNumEntries - numEntries) + " less "
            }
            deltaReport += "since last report";
        }
        this.lastNumEntries = numEntries;
        return "Level Chunk Manager: "
            + numEntries
            + " chunks stored"
            + deltaReport
            + ". (Search took "
            + (endtime - starttime)
            + " ms)";
    }

    async storeChunkContents(contents) {
        //logger.log('info', "LevelChunkManager storing res: " + contents);
        const identifier = await ChunkingUtils.generateIdentifierForData(contents);
        await this.db.put(identifier, contents);
        return identifier;
    }

    async getChunkContents(identifier) {
        //logger.log('info', "LevelChunkManager fetching res: " + identifier);
        var contents;
        try {
            contents = await this.db.get(identifier);
        } catch (error) {
            var newError = Error('Chunk fetch failed: ' + {cause: error});
            if (error.notFound === true) {
                newError.name = 'NOT_FOUND_ERROR';
                contents = undefined;
            }
            throw newError;
        }
        return contents;
    }

}
