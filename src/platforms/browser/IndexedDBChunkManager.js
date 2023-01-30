
import { ChunkManager } from '../../chunking/ChunkManager';
import { ChunkingUtils } from './BrowserExports';
import { IndexedDBBase } from './IndexedDBBase';


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
