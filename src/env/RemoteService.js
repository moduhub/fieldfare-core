
import {ServiceDefinition} from './ServiceDefinition';
import {logger} from '../basic/Log';
import chalk from 'chalk';

export class RemoteService {

    constructor() {
    }

    static fromDefinition(definition) {

        logger.log('info', chalk.green('setup remote service from definition' + JSON.stringify(definition)));

        var newService = new RemoteService(definition.uuid);

        for(const methodName of definition.methods) {
            newService[methodName] = (params) => {

                logger.log('info', methodName + 'called with params: ' + JSON.stringify(params));

                //todo: output a request message

            };
        }

        //Assign service data elements
        ServiceDefinition.buildData(definition, newService);

        return newService;
    }

    setState(state) {

       logger.log('info', 'SERVICE: ' + this.uuid + ' set state:' + JSON.stringify(state));


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
