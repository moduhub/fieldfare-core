
import { ServiceDescriptor } from './ServiceDescriptor';
import { Message } from '../trx/Message';
import { ChunkingUtils } from '../chunking/ChunkingUtils';
import { Collection } from '../structures/Collection';
import { Utils } from '../basic/Utils';
import { logger } from '../basic/Log';

const gServiceImplementations = new Map;

export class LocalService {

    constructor(environment) {
        this.numRequests = 0;
        this.numErrors = 0;
        this.pendingRequests = [];
        this.environment = environment;
    }

    /**
     * Register a class that implements the service assigned to the given UUID
     * @param {string} uuid UUIDv4 of the service
     * @param {Object} implementation Class that implements the service methods
     */
    static registerImplementation(uuid, implementation) {
        gServiceImplementations.set(uuid, implementation);
    }

    /**
     * Construct service instance and validate it against the information contained in
     * environment descriptor assigned to the same UUID
     * @param {String} uuid UUIDv4 of the service to be implemented
     * @param {Environment} environment Environment in which the service will be offered
     * @returns The new service instance
     */
    static async implement(uuid, environment) {
        logger.debug('Implementing ' + JSON.stringify(uuid));
        if(Utils.isUUID(uuid) === false) {
            throw Error('Invalid UUID');
        }
        const implementation = gServiceImplementations.get(uuid);
        if(!implementation) {
            throw Error('Service '+uuid+' local implementation not found');
        }
        //validate implementation methods against environment service descriptor
        const serviceDescriptor = await environment.getServiceDescriptor(uuid);
        if(!serviceDescriptor) {
            throw Error('Environment descriptor for UUID ' + uuid + ' does not exist');
        }
        for(const method of serviceDescriptor.methods) {
            if(implementation.prototype[method] instanceof Function === false) {
                throw Error('Implementation is missing a method: ' + method);
            }
        }
        //create service data
        const serviceInstance = new implementation(environment);
        serviceInstance.collection = new Collection(serviceDescriptor.uuid);
        await serviceInstance.collection.init();
        return serviceInstance;
    }

    async pushRequest(remoteHost, request) {
        const newRequest = {
            remoteHost: remoteHost,
            request: request
        };
        if(this.currentRequest === null
        || this.currentRequest === undefined) {
            this.currentRequest = newRequest;
            await this.treatRequest(newRequest.remoteHost, newRequest.request);
            this.currentRequest = null;
            while(this.pendingRequests.length > 0) {
                const queuedRequest = this.pendingRequests.shift();
                this.currentRequest = queuedRequest;
                await this.treatRequest(queuedRequest.remoteHost, queuedRequest.request);
                this.currentRequest = null;
            }
        } else {
            this.pendingRequests.push(newRequest);
        }
    }

    async treatRequest(remoteHost, request) {
        this.numRequests++;
        var responseData = {
            hash: await ChunkingUtils.generateIdentifierForObject(request.data),
            status: 'done'
        };
        logger.log('info', 'Service UUID: ' + this.uuid
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
