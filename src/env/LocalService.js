
import {ResourcesManager} from '../resources/ResourcesManager';
import {ServiceDefinition} from '../env/ServiceDefinition';
import {Message} from '../Message';
import {logger} from '../basic/Log';


export class LocalService {

    constructor() {

        this.methods = new Map();

        this.numRequests = 0;
        this.numErrors = 0;

	this.pendingRequests = [];

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

    async pushRequest(remoteHost, request) {

        const newRequest = {
            remoteHost: remoteHost,
            request: request
        };

        if(this.currentRequest === null
        || this.currentRequest === undefined) {

		logger.debug('Imediate treatment of request from ' + remoteHost.id);

            this.currentRequest = newRequest;
            await this.treatRequest(newRequest.remoteHost, newRequest.request);
            this.currentRequest = null;

            while(this.pendingRequests.length > 0) {

                const queuedRequest = this.pendingRequests.shift();

		logger.debug('treating a queued request from ' + queuedRequest.remoteHost.id);

                this.currentRequest = queuedRequest;
                await this.treatRequest(queuedRequest.remoteHost, queuedRequest.request);
                this.currentRequest = null;
            }

        } else {
		logger.debug('enqueued a request from ' + remoteHost.id);
            this.pendingRequests.push(newRequest);
        }

    }

    async treatRequest(remoteHost, request) {

        this.numRequests++;

        var responseData = {
            hash: await ResourcesManager.generateKeyForObject(request.data),
            status: 'done'
        };

        logger.log('info', 'Service UUID: ' + this.definition.uuid
            + ' received payload:' + JSON.stringify(request.data));

        for(const prop in request.data) {

            const callback = this.methods.get(prop);

            if(callback
            && callback !== null
            && callback !== undefined) {

                try {

                    responseData.result = await callback(remoteHost, request.data[prop].params);

                } catch (error) {
                    responseData.status = 'error';
                    responseData.error = error;
                    this.numErrors++;
                }

            } else {
                responseData.status = 'error';
                responseData.error = ('undefined method ' + prop);
                this.numErrors++;
                break;
            }

        }

        const response = new Message('response', responseData);

        await remoteHost.send(response);

    }

}
