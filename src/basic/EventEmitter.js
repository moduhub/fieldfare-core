/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

export class EventEmitter {

    constructor() {
        this.listeners = new Map;
    }

    on(event, listener) {
        const listeners = this.listeners.get(event);
        if(listeners) {
            listeners.push(listener);
        } else {
            this.listeners.set(event, [listener]);
        }
    }

    emit(event, ...args) {
        const listeners = this.listeners.get(event);
        if(listeners) {
            for(const listener of listeners) {
                listener(...args);
            }
        }
    }

};