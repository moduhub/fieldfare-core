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
            this.listeners.set(event, [...listeners, listener]);
        } else {
            this.listeners.set(event, [listener]);
        }
        return {event, listener};
    }

    removeEventListener(handle) {
        const listeners = this.listeners.get(handle.event);
        if(listeners) {
            const index = listeners.indexOf(handle.listener);
            if(index >= 0) {
                listeners.splice(index, 1);
            } else 
            if(listeners.size == 0) {
                this.listeners.delete(handle.event);
            } else {
                throw Error('listener not found');
            }
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