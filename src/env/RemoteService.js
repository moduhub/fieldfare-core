/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalHost } from './LocalHost.js';
import { ServiceDescriptor } from './ServiceDescriptor.js';
import { ChunkingUtils } from '../chunking/ChunkingUtils.js';
import { Request } from '../trx/Request.js';
import { logger } from '../basic/Log.js';

export class RemoteService {

    constructor() {
    }

    static fromDescriptor(descriptor) {
        var newService = new RemoteService();
        newService.descriptor = descriptor;
        for(const methodName of descriptor.methods) {
            newService[methodName] = async (params) => {
                if(newService.owner === undefined) {
                    throw Error('RemoteService owner is undefined');
                }
                //logger.debug('[Remote Service]' +  methodName + ' called with params: ' + JSON.stringify(params));
                const request = new Request(newService.descriptor.uuid, 10000, {
                    [methodName]: params
                });
                await LocalHost.signMessage(request);
                const requestIdentifier = await ChunkingUtils.generateIdentifierForObject(request.data);
                newService.owner.pendingRequests.set(requestIdentifier, request);
                console.log('Sending request...', request);
                newService.owner.send(request);
                const response = await request.complete();
                if('data' in response === false) {
                    throw Error('Missing response data');
                }
                if(response.data.status === 'error') {
                    throw Error('Request failed, error:' + response.data.error);
                }
                if(response.data.status !== 'done') {
                    throw Error('Unexpected response status');
                }
                return response.data.result;
            };
        }
        return newService;
    }

    setOwner(owner) {
        this.owner = owner;
    }
}
