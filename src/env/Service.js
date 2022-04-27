
const dataTypes = {
    'list': require('../structures/HashLinkedList.js'),
    'set': require('../structures/HashLinkedTree.js'),
    'obj': Object
};

module.exports = class Service {

    constructor() {

        this.methods = [];
        this.data = new Object;

    }

    static isUUID(uuid) {

        var pattern = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');

        return pattern.test(uuid);

    }

    static validate(definition) {

        // console.log("validate:" + JSON.stringify(definition));

        if('uuid' in definition === false) {
            throw 'missing uuid in service definition';
        }

        if(Service.isUUID(definition.uuid) == false) {
            throw 'service definition uuid invalid';
        }

        if('name' in definition === false) {
            throw 'missing name in ervice definition';
        }

        if(definition.name instanceof String === false
        && typeof definition.name !== 'string') {
            throw 'service definition name is not a string';
        }

        //Do more verifications here

    }

    static customDataType(name, type) {

        if(name in dataTypes) {
            throw 'customDataType name already used';
        }

        dataTypes[name] = type;

    }

    static fromDefinition(definition) {

        var newService = new Service();

        newService.definition = definition;

        console.log('definition.data: ' + JSON.stringify(definition));

        for(const entry of definition.data) {

            console.log("Processing entry " + JSON.stringify(entry));

            const typeClass = dataTypes[entry.type];

            if(typeClass) {
                var newEntry = new typeClass;
            } else {
                throw 'unknown service data type: ' + entry.type;
            }

            newEntry.name = entry.name; //is this a bad practice?
            newService.data[entry.name] = newEntry;

        }

        return newService;
    }

    getState() {

        var serviceState = new Object;

        for(const prop in this.data) {

            console.log("data.name: " + prop);
            console.log("stateId: " + this.data[prop].getState());
            serviceState[prop] = this.data[prop].getState();
        }

        return serviceState;
    }

    setState(state) {

        // console.log("Service " + this.definition.name + "setState()");

        for(const prop in state) {

            // console.log("entry state: " + state[prop]);

            if(prop in this.data === false) {
                throw 'state data mismatch';
            }

            const entryState = state[prop];
            this.data[prop].setState(entryState);

        }

    }
}
