
import { ChunkManager } from '../../chunking/ChunkManager';
import { ChunkingUtils } from '../../chunking/ChunkingUtils';
import { logger } from '../../basic/Log';

const { Level } = require('level');

export class LevelChunkManager extends ChunkManager {

    constructor() {
        super();
        this.db = new Level('chunk', { valueEncoding: 'json' })
    }

    static init() {
        const newInstance = new LevelChunkManager;
        ChunkManager.addInstance(newInstance);
        setInterval(async () => {
            logger.debug(await newInstance.report());
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
        return "Level Resources Manager: "
            + numEntries
            + " resources stored"
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
            var newError = Error('Resource fetch failed: ' + {cause: error});
            if (error.notFound === true) {
                newError.name = 'NOT_FOUND_ERROR';
                contents = undefined;
            }
            throw newError;
        }
        return contents;
    }

}
