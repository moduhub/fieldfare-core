/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {Utils} from '../basic/Utils.js';

export class ServiceDescriptor {

    static validate(descriptor) {
        Utils.validateParameters(descriptor, ['uuid', 'name', 'methods', 'collection']);
        if(Utils.isUUID(descriptor.uuid) == false) {
            throw Error('service descriptor uuid invalid');
        }
        if(descriptor.name instanceof String === false
        && typeof descriptor.name !== 'string') {
            throw Error('service descriptor name is not a string');
        }
        if(descriptor.methods instanceof Array === false) {
            throw Error('descriptor methods must be an array');
        }
        if(descriptor.collection instanceof Array === false) {
            throw Error('descriptor collection must be an array');
        }
    }
    
};
