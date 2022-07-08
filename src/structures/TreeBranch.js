

export class TreeBranch {

    constructor(ownerID, origin) {
        this.ownerID = ownerID;
        this.origin = origin;
        this.depth= 0;
        this.containerKeys = [];
        this.containers = [];
        this.containsKey: false;
    }

    async getToKey(key) {
        this.key = key;
        var iContainer = await TreeContainer.fromResource(this.origin, this.ownerID);
        this.containerKeys[0] = this.origin;
        this.containers[0] = iContainer;
        var nextContainerKey = iContainer.follow(key);
        while(nextContainerKey !== '') {
            if(nextContainerKey === true) {
                this.containsKey = true;
                break;
            }
            iContainer = await TreeContainer.fromResource(nextContainerKey, this.ownerID);
            this.depth++;
            if(iContainer === null
            || iContainer === undefined) {
                throw Error('iContainer object not found');
            }
            this.containerKeys.push(nextContainerKey);
            this.containers.push(iContainer);
            nextContainerKey = iContainer.follow(key);
        }
        return this;
    }

    async getToLeftmostLeaf() {
        throw Error('not implemented');
    }

    async getToRightmostLeaf() {
        throw Error('not implemented');
    }

    async update(depth) {
        if(depth === undefined) {
            depth = this.depth;
        }
        while(depth > 0) {
            const newContainerKey = await ResourcesManager.storeResourceObject(this.containers[depth]);
            // logger.log('info',   "depth: " + depth
            // 	+ "current: " + currentContainerHash
            // 	+ " prev: " + prevBranchHashes[depth]);
            if(newContainerKey !== this.containerKeys[depth]) {
                this.containers[depth-1].updateChild(this.containerKeys[depth], newContainerKey);
                //Free previous resource?
            } else {
                //this should never happen?
                throw Error('this was unexpected, check code');
            }
            depth--;
        }
        const newRoot = await ResourcesManager.storeResourceObject(this.containers[0]);
        return newRoot;
    }
}
