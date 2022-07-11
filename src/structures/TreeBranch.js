

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

    async rebalance() {
        var depth = this.depth;
        while(depth > 0) {
            var iContainer = this.containers[depth--];
            if(iContainer.numElements < minElements) {
                const parentContainer = this.container[depth-1];
                const [leftSiblingKey, rightSiblingKey, parentKey] = parentContainer.popChild(branch.prevHashes[depth]);
                const leftSibling = await TreeContainer.fromResource(leftSiblingKey, this.ownerID);
                const rightSibling = await TreeContainer.fromResource(rightSiblingKey, this.ownerID);
                //debugger;
                if(leftSibling.numElements > minElements) {
                    //rotate from left
                    const [rotatedKey, rotatedChildKey] = leftSibling.pop();
                    parentNode.substituteKey(parentKey, rotatedKey);
                    iContainer.unshift(parentKey, rotatedChildKey);
                } else
                if(rightSibling.numElements > minElements) {
                    //rotate from right
                    const [rotatedKey, rotatedChildKey] = rightSibling.shift();
                    parentNode.substituteKey(parentKey, rotatedKey);
                    iContainer.push(parentKey, rightSiblingKey);
                } else {
                    //Choice between left or right merge is free
                    iContainer.mergeLeft(leftSibling, parentKey);
                }
            }
        }
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
        var newRoot = '';
        if(this.containers[0].numElements > 0) { //removed last element from list?
            newRoot = await ResourcesManager.storeResourceObject(this.containers[0]);
        }
        return newRoot;
    }
}
