import { LocalHost } from "../env/LocalHost.js";

export class Change {

    constructor(method, params) {
        this.method = method;
        this.params = params;
    }

    get descriptor() {
        return {
            method: this.method,
            params: this.params
        };
    }

    setIssuer(issuer) {
        this.issuer = issuer;
    }

    setAction(callback) {
        if(callback instanceof Function === false) {
            throw Error('callback must be a function');
        }
        this.actionCallback = callback;
        return this;
    }

    setMergePolicy(callback) {
        if(callback instanceof Function === false) {
            throw Error('callback must be a function');
        }
        this.mergeCallback = callback;
        return this;
    }

    setAuth(callback) {
        if(callback instanceof Function === false) {
            throw Error('callback must be a function');
        }
        this.authCallback = callback;
        return this;
    }

    async execute(merge=false) {
        if(!this.issuer) {
            throw Error('issuer not set');
        }
        if(this.authCallback) {
            const auth = await this.authCallback(this.issuer);
            if(!auth) {
                throw Error('issuer not authorized');
            }
        }
        if(merge) {
            if(!this.mergeCallback) {
                const mergeAllowed = await this.mergeCallback();
                if(mergeAllowed) {
                    await this.actionCallback();
                } else {
                    //merge bypassed
                }
            }
        } else {
            await this.actionCallback();
        }
    }

}