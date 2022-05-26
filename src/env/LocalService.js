
import {logger} from '../basic/Log'

import {ServiceDefinition} from './ServiceDefinition';


module.exports = class LocalService {

    constructor() {

        this.methods = new Map();

    }

    static fromDefinition(definition) {

        var newService = new LocalService();

        newService.definition = definition;

        ServiceDefinition.buildData(definition, newService);

        logger.log('info', 'definition.data: ' + JSON.stringify(definition));

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
