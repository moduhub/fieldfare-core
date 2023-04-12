import { LocalHost } from "../env/LocalHost.js";

export class Change {

    constructor(method, params) {
        this.method = method;
        this.params = params;
    }

    get descriptor() {
        return {
            issuer: this.issuer,
            method: this.method,
            params: this.params
        };
    }

    set descriptor(descriptor) {
        this.issuer = descriptor.issuer;
        this.method = descriptor.method;
        this.params = descriptor.params;
    }

    setAuth(callback) {
        if(callback instanceof Function === false) {
            throw Error('callback must be a function');
        }
        this.authCallback = callback;
        return this;
    }

    setAction(callback) {
        if(callback instanceof Function === false) {
            throw Error('callback must be a function');
        }
        this.actionCallback = callback;
        return this;
    }

    async apply() {
        if(!this.issuer) {
            throw Error('issuer not set');
        }
        if(this.authCallback) {
            await this.authCallback(issuer);
        }
        await this.actionCallback();
    }

}