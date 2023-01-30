
import { LocalHost } from './LocalHost';
import { ServiceDefinition } from './ServiceDefinition';
import { ChunkingUtils } from '../chunking/ChunkingUtils';
import { Request } from '../trx/Request';
import { logger } from '../basic/Log';


export class RemoteService {

    constructor() {
    }

    static fromDefinition(definition) {

        var newService = new RemoteService();

        newService.definition = definition;

        for(const methodName of definition.methods) {
            newService[methodName] = async (params) => {

                if(newService.owner === undefined) {
                    throw Error('RemoteService owner is undefined');
                }

                logger.debug('[Remote Service]' +  methodName + ' called with params: ' + JSON.stringify(params));

                const request = new Request(newService.definition.uuid, 10000, {
                    [methodName]: {
                        params: params
                    }
                });

                await LocalHost.signMessage(request);

                const requestIdentifier = await ChunkingUtils.generateidentifierForObject(request.data);

                newService.owner.pendingRequests.set(requestIdentifier, request);

                newService.owner.send(request);

                const response = await request.complete();

                if('data' in response === false) {
                    throw Error('Missing response data');
                }

                if(response.data.status === 'error') {
                    throw Error('Request failed, error:' + response.data.error);
                }

                if(response.data.status !== 'done') {
                    throw Error('Unexpected response status');
                }

                return response.data.result;
            };
        }

        //Assign service data elements
        ServiceDefinition.buildData(definition, newService);

        return newService;
    }

    setOwner(owner) {
        this.owner = owner;
        for(const prop in this.data) {
            this.data[prop].setOwnerID(owner.id);
        }
    }

    setState(state) {
       // logger.debug('[RemoteService] ' + this.definition.uuid + ' set state:' + JSON.stringify(state));
       var stateChanged = false;
       for(const prop in state) {
           // logger.log('info', "entry state: " + state[prop]);
           if(prop in this.data === false) {
               throw Error('state data mismatch');
           }
           const entryNewState = state[prop];
           const entryPrevState = this.data[prop].getState();
           if(entryNewState !== entryPrevState) {
            //    logger.debug('[RemoteService] Entry '+ this.definition.uuid + '.' + prop + ' state changed '
            // + ' from \''  + entryPrevState
            // + '\' to \'' + entryNewState + '\'');
               this.data[prop].setState(entryNewState);
               stateChanged = true;
           }
       }
       if(stateChanged && this.onStateUpdate) {
           this.onStateUpdate(state);
       }
    }

}
