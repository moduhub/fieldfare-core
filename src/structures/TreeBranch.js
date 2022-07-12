

export class TreeBranch {

    constructor(ownerID, origin) {
        this.ownerID = ownerID;
        this.origin = origin;
        this.depth= 0;
        this.containerKeys = [];
        this.containers = [];
        this.containsKey: false;
    }

    append(other) {
        this.depth += other.depth;
        this.containers = [this.containers, ...other.containers];
        this.containerKeys = [this.containerKeys, ...other.containerKeys];
        this.key = other.key;
        this.containsKey = other.containsKey;
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
        while(depth > 1) {
            const iContainerKey = this.containerKeys[depth]
            const iContainer = this.containers[depth];
            deph--;
            const parentContainer = this.container[depth];
            if(iContainer.numElements < minElements) {
                const [leftSiblingKey, leftKey] = parentContainer.getLeftSibling(iContainerKey);
                const leftSibling = await TreeContainer.fromResource(leftSiblingKey, this.ownerID);
                if(leftSibling.numElements > minElements) { //rotate from left
                    debugger;
                    const [rotatedKey, rotatedChildKey] = leftSibling.pop();
                    parentContainer.substituteKey(parentKey, rotatedKey);
                    const newLeftSiblingKey = await ResourcesManager.storeResourceObject(leftSibling);
                    parentContainer.updateChild(leftSiblingKey, newLeftSiblingKey);
                    iContainer.unshift(parentKey, rotatedChildKey);
                } else {
                    const [rightSiblingKey, rightKey] = parentContainer.getRightSibling(iContainerKey);
                    const rightSibling = await TreeContainer.fromResource(rightSiblingKey, this.ownerID);
                    if(rightSibling.numElements > minElements) { //rotate from right
                        debugger;
                        const [rotatedKey, rotatedChildKey] = rightSibling.shift();
                        parentNode.substituteKey(parentKey, rotatedKey);
                        iContainer.push(parentKey, rightSiblingKey);
                    } else {
                        debugger;
                        //Choice between left or right merge is free
                        parentContainer.popChild(iContainerKey);
                        iContainer.mergeLeft(leftSibling, parentKey);
                    }
                }
            }
        }
    }

    async update(pDepth) {
        var depth = pDepth;
        if(pDepth === undefined) {
            depth = this.depth;
        }
        if(this.containers[0].numElements > 0) { //removed last element from list?
            while(depth > 1) {
                const parentContainer = this.containers[depth-2];
                const iContainer = this.containers[depth-1];
                const prevContainerKey = this.containerKeys[depth-1];
                const newContainerKey = await ResourcesManager.storeResourceObject(iContainer);
                this.containerKeys[depth-1] = newContainerKey;
                parentContainer.updateChild(prevContainerKey, newContainerKey);
                depth--;
            }
            this.containerKeys[0] = await storeResourceObject(this.containers[0]);
        } else {
            this.depth = 0;
            this.containerKeys[0] = '';
        }
        return this.containerKeys[0];
    }
}
