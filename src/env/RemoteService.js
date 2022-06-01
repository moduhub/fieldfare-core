
import {ServiceDefinition} from '../env/ServiceDefinition';
import {ResourcesManager} from '../resources/ResourcesManager';
import {Request} from '../Request';
import {logger} from '../basic/Log';


export class RemoteService {

    constructor() {
    }

    static fromDefinition(definition) {

        var newService = new RemoteService();

        newService.definition = definition;

        for(const methodName of definition.methods) {
            newService[methodName] = async (params) => {

                if(newService.owner == undefined) {
                    throw Error('RemoteService owner is undefined');
                }

                logger.log('info', methodName + 'called with params: ' + JSON.stringify(params));

                const request = new Request(newService.definition.uuid, 10000, {
                    [methodName]: {
                        params: params
                    }
                });

                request.setDestinationAddress(newService.owner);

                await host.signMessage(request);

                const requestKey = await ResourcesManager.generateKeyForObject(request.data);

                newService.owner.pendingRequests.set(requestKey, request);

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

    setState(state) {

       logger.log('info', 'SERVICE: ' + this.definition.uuid + ' set state:' + JSON.stringify(state));

       for(const prop in state) {

           // logger.log('info', "entry state: " + state[prop]);

           if(prop in this.data === false) {
               throw Error('state data mismatch');
           }

           const entryState = state[prop];
           this.data[prop].setState(entryState);

       }

    }

    //match request/response

}
