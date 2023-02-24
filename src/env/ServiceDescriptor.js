import {Utils} from '../basic/Utils';


export class ServiceDescriptor {

    static validate(descriptor) {
        Utils.validateParameters(descriptor, ['uuid', 'name', 'methods', 'data']);
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
        if(descriptor.data instanceof Array === false) {
            throw Error('descriptor methods must be an array');
        }
    }
    
};
