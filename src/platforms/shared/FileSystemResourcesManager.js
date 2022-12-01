import {ResourcesManager} from '../../resources/ResourcesManager';
import {logger} from '../../basic/Log';

export class FileSystemResourcesManager extends ResourcesManager {

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
        const newInstance = new FileSystemResourcesManager(dir);
        ResourcesManager.addInstance(newInstance);
    }

    async storeResource(base64data) {
        const base64hash = await ResourcesManager.generateKeyForData(base64data);
        return new Promise((resolve, reject) => {
            logger.log('info', "FileSystemResourcesManager storing res: " + base64data);
            const base64hash_trunc = base64hash.substring(0,8);
            this.fs.writeFile(this.dir + base64hash_trunc + '.res', base64data, function (err) {
                if(err) {
                    reject(err);
                } else {
                    resolve(base64hash);
                }
            });
        });
    }

    getResource(base64hash) {
        logger.log('info', "FileSystemResourcesManager fetching res: " + base64hash);
        return new Promise((resolve,reject) => {
            const base64hash_trunc = base64hash.substring(0,8);
            this.fs.readFile(base64hash_trunc+'.res', function(err, data) {
                if(err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

}
