/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { LocalHost } from './LocalHost.js';

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
                const request = await LocalHost.request(
                    newService.descriptor.uuid,
                    newService.owner.id,
                    {[methodName]: params});
                const response = await request.complete();
                if('data' in response === false) {
                    throw Error('Missing response data');
                }
                if(response.data.status === 'error') {
                    throw Error('Request failed, error:' + JSON.stringify(response.data.error));
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
