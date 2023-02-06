
import {ChunkList} from '../structures/ChunkList';
import {ChunkSet} from '../structures/ChunkTree';
import {Utils} from '../basic/Utils';

const dataTypes = {
    'list': ChunkList,
    'set': ChunkSet,
    'map': ChunkMap,
    'obj': Object
};

export class ServiceDefinition {

    static buildData(definition, service) {

        service.data = new Object;

        for(const entry of definition.data) {

            var newEntry;

            const typeClass = dataTypes[entry.type];

            if(typeClass) {
                newEntry = new typeClass;
            } else {
                throw Error('unknown service data type: ' + entry.type);
            }

            newEntry.name = entry.name;

            service.data[entry.name] = newEntry;

        }

        return service.data;
    }

    static validate(definition) {

        // logger.log('info', "validate:" + JSON.stringify(definition));

        if('uuid' in definition === false) {
            throw Error('missing uuid in service definition');
        }

        if(Utils.isUUID(definition.uuid) == false) {
            throw Error('service definition uuid invalid');
        }

        if('name' in definition === false) {
            throw Error('missing name in ervice definition');
        }

        if(definition.name instanceof String === false
        && typeof definition.name !== 'string') {
            throw Error('service definition name is not a string');
        }

        //Do more verifications here

    }

    static customDataType(name, type) {

        if(name in dataTypes) {
            throw Error('customDataType name already used');
        }

        dataTypes[name] = type;

    }

};
