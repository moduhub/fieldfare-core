import { logger } from '../basic/Log.js';

export class Change {

    constructor(method, ...params) {
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
            throw Error('change issuer not set');
        }
        logger.debug('[CHANGE] Authorizing...');
        if(this.authCallback) {
            const auth = await this.authCallback(this.issuer);
            if(!auth) {
                throw Error('issuer not authorized');
            }
        }
        if(merge) {
            logger.debug('[CHANGE] Checking merge policy...');
            if(this.mergeCallback) {
                const mergeAllowed = await this.mergeCallback();
                if(mergeAllowed) {
                    logger.debug('[CHANGE] Merging...');
                    await this.actionCallback();
                } else {
                    //merge bypassed
                    logger.debug('[CHANGE] Bypassed.');
                }
            }
        } else {
            logger.debug('[CHANGE] Executing...');
            await this.actionCallback();
        }
        logger.debug('[CHANGE] Done.');
    }

}