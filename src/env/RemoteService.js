
module.exports = class RemoteService {

    constructor() {
        //
    }

    static asycn setup(definition) {
        this.uuid = definition.uuid;

        for(const methodName of definition.methods) {
            this[methodName] = () => {
                logger.log('info', methodName + 'called!');

                //todo: output a request message
                
            }
        }
    }

    //match request/response

}
