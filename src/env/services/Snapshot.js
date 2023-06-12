/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalService } from '../LocalService.js';
import { Chunk } from '../../chunking/Chunk.js';
import { HostIdentifier } from '../HostIdentifier.js';
import { Utils } from '../../basic/Utils.js';
import { cryptoManager } from '../../basic/CryptoManager.js';

export {SnapshotService as implementation};

export const uuid = 'd2b38791-51af-4767-ad08-2f9f1425e90e';

export class SnapshotService extends LocalService {

    async store(remoteHost, stateMessage) {

        console.log('SnapshotService.store() called with stateMessage: ' + JSON.stringify(stateMessage) + ' from remote ' + remoteHost.id);

        //1) Check if remoteHost belongs to the enviroment
        // if(await this.environment.belongs(remoteHost) === false) {
        //     throw Error('host does not belong to the environment');
        // }

        //2) Check if provided state is valid
        console.log('newState', stateMessage);
        Utils.validateParameters(stateMessage, ['service', 'data', 'signature', 'source']);
        Utils.validateParameters(stateMessage.data, ['id', 'ts', 'collections']);
        const timeDelta = Date.now() - stateMessage.data.ts;
        if(timeDelta > 1000 * 60 * 60 * 24) {   //a day
            throw Error('state is too old');
        }
        const signatureIsValid = await cryptoManager.verifyMessage(stateMessage, remoteHost.pubKey);
        if(!signatureIsValid) {
            throw Error('signature is invalid');
        }

        //3) Check if provided state is newer than previous
        const hostStates = await this.collection.getElement('hostStates');
        if(hostStates) {
            const keyChunk = Chunk.fromIdentifier(HostIdentifier.toChunkIdentifier(remoteHost.id));
            const valueChunk = await hostStates.get(keyChunk);
            let prevState = null;
            let stateIsNewer = false;
            if(valueChunk) {
                prevState = await valueChunk.expand(0);
                console.log('prevState', prevState);
                if(prevState.data.ts < stateMessage.data.ts) {
                    stateIsNewer = true;
                }
            }
            if(stateIsNewer || !prevState) {
                const stateChunk = await Chunk.fromObject(stateMessage);
                //4) Touch status full contents
                //await stateChunk.touch();
                //5) Store state as latest
                await hostStates.set(keyChunk, stateChunk);
                await this.collection.updateElement('hostStates', hostStates.descriptor);
                return 'ok';
            }
        }
        
        return 'state is stale';
    }

};