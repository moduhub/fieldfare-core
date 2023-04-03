/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalService } from '../LocalService.js';

export {SnapshotService as implementation};

export const uuid = 'd2b38791-51af-4767-ad08-2f9f1425e90e';

export class SnapshotService extends LocalService {

    async store(remoteHost, statusMessage) {

        //1) Check if remoteHost belongs to the enviroment
        if(await this.environment.belongs(remoteHost) === false) {
            throw Error('host does not belong to the environment');
        }

        //2) Check if provided status is newer than previous
        //3) Touch status full contents

    }

};