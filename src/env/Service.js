

module.exports = class Service {

    constructor() {

    }

    static isUUID(uuid) {

        var pattern = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');

        return pattern.test(uuid);

    }

    static validate(definition) {

        console.log("validate:" + JSON.stringify(definition));

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

        //Do more verifications heres

    }


}
