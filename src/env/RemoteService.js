
import {ServiceDefinition} from './ServiceDefinition';
import {Request} from '../Request';
import {logger} from '../basic/Log';
import chalk from 'chalk';

export class RemoteService {

    constructor() {
    }

    static fromDefinition(definition) {

        logger.log('info', chalk.green('setup remote service from definition' + JSON.stringify(definition)));

        var newService = new RemoteService();

        newService.definition = definition;

        for(const methodName of definition.methods) {
            newService[methodName] = async (params) => {

                if(newService.owner == undefined) {
                    throw Error('RemoteService owner is undefined');
                }

                logger.log('info', methodName + 'called with params: ' + JSON.stringify(params));

                const request = new Request(newService.definition.uuid, 10000, {
                    params: params
                });

                request.setDestinationAddress(newService.owner);

                await host.signMessage(request);

                newService.owner.send(request);

                const response = await request.complete();

                return response;
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
