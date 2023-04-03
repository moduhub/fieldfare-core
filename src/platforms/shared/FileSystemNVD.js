/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {NVD} from '../../basic/NVD.js'

export class FileSystemNVD {

    constructor(dir) {
        this.dir = dir;
        if(dir.slice(-1) !== '/') {
            this.dir += '/';
        }
    }

    static init(dir) {
        if(global.fs === null) {
            this.fs = require('fs')
        } else {
            this.fs = global.fs;
        }
        NVD.singleton(new FileSystemNVD(dir));
    }

    save(key, object) {
        return new Promise((resolve, reject) => {
            logger.log('info', "FileSystemNVD storing data on key: " + key);
            stringifiedData = JSON.stringify(object);
            this.fs.writeFile(this.dir + key + '.nvd', stringifiedData, function (err) {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    load(key) {
        return new Promise((resolve,reject) => {
            logger.log('info', "FileSystemNVD fetching nvd for key: " + key);
            this.fs.readFile(this.dir + key + '.res', function(err, data) {
                if(err) {
                    reject(err);
                } else {
                    const object = JSON.parse(data);
                    resolve(data);
                }
            });
        });
    }

};
