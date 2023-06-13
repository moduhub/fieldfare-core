/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Message } from '../trx/Message.js';
import { ChunkingUtils } from '../chunking/ChunkingUtils.js';
import { Collection } from '../structures/Collection.js';
import { Utils } from '../basic/Utils.js';
import { logger } from '../basic/Log.js';

const gServiceImplementations = new Map;

export class LocalService {

    constructor(environment) {
        this.numRequests = 0;
        this.numErrors = 0;
        this.pendingRequests = [];
        this.environment = environment;
    }

    /**
     * Check implementation uuid and class for validity
     * @param {string} uuid UUIDv4 of the service
     * @param {Object} implementation Class that implements a LocalService
     */
    static validateImplementation(uuid, implementation) {
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
    }

    /**
     * Register a class that implements the service assigned to the given UUID
     * @param {string} uuid UUIDv4 of the service
     * @param {Object} implementation Class that implements the service methods
     */
    static registerImplementation(uuid, implementation) {
        LocalService.validateImplementation(uuid, implementation);
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
            if(implementation.prototype[method] instanceof Function === false
            && implementation.prototype[method] instanceof AsyncFunction === false) {
                throw Error('Implementation is missing a method: ' + method);
            }
        }
        //create service data
        const serviceInstance = new implementation(environment);
        serviceInstance.collection = await Collection.getLocalCollection(serviceDescriptor.uuid);
        for await (const {name: definedName, descriptor: definedDescriptor} of serviceDescriptor.collection) {
            const localElement = await serviceInstance.collection.getElement(definedName);
            if(localElement) {
                const localDescriptor = localElement.descriptor;
                for(const prop in definedDescriptor) {
                    if(localDescriptor.hasOwnProperty(prop) === false
                    || localDescriptor[prop] !== definedDescriptor[prop]) {
                        throw Error('mismatch between previous service state and environment provided descriptor');
                    }
                }
            } else {
                await serviceInstance.collection.createElement(definedName, definedDescriptor);
            }
        }
        serviceInstance.descriptor = serviceDescriptor;
        await serviceInstance.collection.publish();
        logger.debug('Service ' + JSON.stringify(uuid) + ' implemented successfully');
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
        this.numRequests++;
        if(!request.data) {
            throw Error('request contains no data');
        }
        var responseData = {
            hash: await ChunkingUtils.generateIdentifierForObject(request.data),
            status: 'done'
        };
        logger.debug('Service UUID: ' + this.descriptor.uuid
            + ' received payload:' + JSON.stringify(request.data));
        for(const prop in request.data) {
            const methodImplementation = this[prop].bind(this);
            if(methodImplementation
            && methodImplementation !== null
            && methodImplementation !== undefined) {
                if(!(methodImplementation instanceof Function)
                && !(methodImplementation instanceof AsyncFunction)) {
                    throw Error('method name not a valid function: ' + prop);
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
