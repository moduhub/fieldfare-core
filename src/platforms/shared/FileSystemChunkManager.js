import { ChunkManager } from '../../chunking/ChunkManager';
import { ChunkingUtils } from './CommonExports';
import { logger } from '../../basic/Log';

export class FileSystemChunkManager extends ChunkManager {

    constructor(dir) {
        super();
        this.dir = dir;
        if(dir.slice(-1) !== '/') {
            this.dir += '/';
        }
    }

    static init(dir) {
        if(global.fs === null) {
            this.fs = require('fs');
        } else {
            this.fs = global.fs;
        }
        const newInstance = new FileSystemChunkManager(dir);
        ChunkManager.addInstance(newInstance);
    }

    async storeChunkContents(contents) {
        const identifier = await ChunkManager.generateIdentifierForData(contents);
        return new Promise((resolve, reject) => {
            logger.log('info', "FileSystemChunkManager storing res: " + contents);
            const identifier_trunc = identifier.substring(0,8); //risky?
            this.fs.writeFile(this.dir + identifier_trunc + '.res', contents, function (err) {
                if(err) {
                    reject(err);
                } else {
                    resolve(identifier);
                }
            });
        });
    }

    getChunkContents(identifier) {
        logger.log('info', "FileSystemChunkManager fetching res: " + identifier);
        return new Promise((resolve,reject) => {
            const identifier_trunc = identifier.substring(0,8);
            this.fs.readFile(identifier_trunc+'.res', function(err, contents) {
                if(err) {
                    reject(err);
                } else {
                    resolve(contents);
                }
            });
        });
    }

}
