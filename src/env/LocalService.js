
const Utils = require('../basic/Utils.js');

import {logger} from '../basic/Log'

const dataTypes = {
    'list': require('../structures/HashLinkedList.js'),
    'set': require('../structures/HashLinkedTree.js'),
    'map': require('../structures/HashLinkedTree.js'),
    'obj': Object
};

module.exports = class Service {

    constructor() {

        this.methods = new Map();
        this.data = new Object;

    }

    static validate(definition) {

        // logger.log('info', "validate:" + JSON.stringify(definition));

        if('uuid' in definition === false) {
            throw 'missing uuid in service definition';
        }

        if(Utils.isUUID(definition.uuid) == false) {
            throw 'service definition uuid invalid';
        }

        if('name' in definition === false) {
            throw 'missing name in ervice definition';
        }

        if(definition.name instanceof String === false
        && typeof definition.name !== 'string') {
            throw 'service definition name is not a string';
        }

        //Do more verifications here

    }

    static customDataType(name, type) {

        if(name in dataTypes) {
            throw Error('customDataType name already used');
        }

        dataTypes[name] = type;

    }

    static fromDefinition(definition) {

        var newService = new Service();

        newService.definition = definition;

        logger.log('info', 'definition.data: ' + JSON.stringify(definition));

        for(const entry of definition.data) {

            logger.log('info', "Processing entry " + JSON.stringify(entry));

            const typeClass = dataTypes[entry.type];

            if(typeClass) {
                var newEntry = new typeClass;
            } else {
                throw Error('unknown service data type: ' + entry.type);
            }

            newEntry.name = entry.name; //is this a bad practice?
            newService.data[entry.name] = newEntry;

        }

        return newService;
    }

    updateState() {

        var newState = new Object;

        for(const prop in this.data) {

            logger.log('info', "data.name: " + prop);
            logger.log('info', "stateId: " + this.data[prop].getState());
            newState[prop] = this.data[prop].getState();
        }

        if(this.prevState !== newState) {
            const uuid = this.definition.uuid;
            logger.log('info', "Storing service state " + uuid + '->' + JSON.stringify(newState, null, 2));
            nvdata.save(uuid, newState);
            this.prevState = newState;
        }

        return newState;
    }

    setState(state) {

        // logger.log('info', "Service " + this.definition.name + "setState()");

        for(const prop in state) {

            // logger.log('info', "entry state: " + state[prop]);

            if(prop in this.data === false) {
                throw Error('state data mismatch');
            }

            const entryState = state[prop];
            this.data[prop].setState(entryState);

        }

    }

    assignMethod(name, callback) {

        this.methods.set(name, callback);

    }

    treatRequest(remoteHost, payload) {

        logger.log('info', 'Service UUID: ' + this.definition.uuid
            + ' received payload:' + JSON.stringify(payload));

        for(const prop in payload) {

            const callback = this.methods.get(prop);

            if(callback
            && callback !== null
            && callback !== undefined) {
                callback(remoteHost, payload);
            } else {
                throw Error('undefined method \"'+prop+'\" requested from service ' + this.uuid);
            }
        }

    }

}
