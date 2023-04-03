/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { ChunkManager } from '../../chunking/ChunkManager.js';
import { ChunkingUtils } from './BrowserExports.js';
import { IndexedDBBase } from './IndexedDBBase.js';

export class IndexedDBResourcesManager extends ChunkManager {

    constructor() {
        super();
        this.db = new IndexedDBBase('chunk');
    }

    static init() {
        const newInstance = new IndexedDBChunkManager;
        ChunkManager.addInstance(newInstance);
    }

    async storeChunkContents(contents) {
        const identifier = await ChunkingUtils.generateIdentifierForData(contents);
        await this.db.put(identifier, contents);
        return identifier;
    }

    async getChunkContents(chunkIdentifier) {
        const contents = await this.db.get(chunkIdentifier);
        return contents;
    }

};
