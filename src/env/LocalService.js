
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
        if(!Utils.isUUID(uuid)) {
            throw Error('Invalid UUID');
        }
        const testInstance = new implementation;
        if(!(testInstance instanceof LocalService)) {
            throw Error('Invalid service implementation');
        }
        if(gServiceImplementations.has(uuid)) {
            throw Error('Attempt to register duplicate uuid');
        }
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
            throw Error('Invalid UUID: ' + JSON.stringify(uuid));
        }
        const implementation = gServiceImplementations.get(uuid);
        if(!implementation) {
            throw Error('Service '+uuid+' local implementation not found');
        }
        //validate implementation methods against environment service descriptor
        const serviceDescriptor = await environment.getServiceDescriptor(uuid);
        if(!serviceDescriptor) {
            throw Error('Environment did not define service: ' + uuid);
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
        for await (const definedElement of serviceDescriptor.collection) {
            const localElement = await serviceInstance.collection.getElement(definedElement.name);
            if(localElement) {
                const localElementDescriptor = localElement.descriptor;
                for(const prop in definedElement.descriptor) {
                    if(!localElementDescriptor.hasOwnProperty(prop)) {
                        throw Error('mismatch between privous service state and environment provided descriptor');
                    }
                }
            } else {
                await serviceInstance.collection.createElement(definedElement.name, definedElement.descriptor);
            }
        }
        return serviceInstance;
    }

    async pushRequest(remoteHost, request) {
        if(!remoteHost) {
            throw Error('remote host is undefined');
        }
        if(!request) {
            throw Error('request is undefined');
        }
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
        console.log(request);
        this.numRequests++;
        if(!request.data) {
            throw Error('request contains no data');
        }
        var responseData = {
            hash: await ChunkingUtils.generateIdentifierForObject(request.data),
            status: 'done'
        };
        logger.log('info', 'Service UUID: ' + this.uuid
            + ' received payload:' + JSON.stringify(request.data));
        for(const prop in request.data) {
            const methodImplementation = this[prop];
            if(methodImplementation
            && methodImplementation !== null
            && methodImplementation !== undefined) {
                if(!(methodImplementation instanceof Function)
                && !(methodImplementation instanceof AsyncFunction)) {
                    throw Error('mathod name not a valid function: ' + prop);
                }
                try {
                    responseData.result = await methodImplementation(remoteHost, request.data[prop]);
                } catch (error) {
                    responseData.status = 'error';
                    responseData.error = error;
                    this.numErrors++;
                }
            } else {
                responseData.status = 'error';
                responseData.error = ('undefined method: ' + prop);
                this.numErrors++;
                break;
            }
        }
        const response = new Message('response', responseData);
        await remoteHost.send(response);
    }

}
