
import {ResourcesManager} from '../resources/ResourcesManager';
import {TreeContainer} from './TreeContainer';
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';

export class TreeBranch {

    constructor(ownerID, origin) {
        this.ownerID = ownerID;
        this.origin = origin;
        this.depth = 0;
        this.containerKeys = [];
        this.containers = [];
        this.containsKey = false;
    }

    getLastContainer() {
        return this.containers[this.depth-1];
    }

    append(other) {
        this.depth += other.depth;
        this.containers = [...this.containers, ...other.containers];
        this.containerKeys = [...this.containerKeys, ...other.containerKeys];
        this.key = other.key;
        this.containsKey = other.containsKey;
    }

    async getToKey(key) {
        this.key = key;
        this.depth = 0;
        var nextContainerKey = this.origin;
        while(nextContainerKey !== '') {
            const iContainer = await TreeContainer.fromResource(nextContainerKey, this.ownerID);
            if(iContainer === null
            || iContainer === undefined) {
                throw Error('iContainer object not found');
            }
            this.depth++;
            this.containerKeys.push(nextContainerKey);
            this.containers.push(iContainer);
            nextContainerKey = iContainer.follow(key);
            if(nextContainerKey === true) {
                this.containsKey = true;
                break;
            }
        }
        return this;
    }

    async getToLeftmostLeaf() {
        var nextContainerKey = this.origin;
        this.depth = 0;
        while(nextContainerKey !== '') {
            const iContainer = await TreeContainer.fromResource(nextContainerKey, this.ownerID);
            this.depth++;
            this.containerKeys.push(nextContainerKey);
            this.containers.push(iContainer);
            nextContainerKey = iContainer.getLeftmostChild();
        }
    }

    async getToRightmostLeaf() {
        var nextContainerKey = this.origin;
        this.depth = 0;
        while(nextContainerKey !== '') {
            const iContainer = await TreeContainer.fromResource(nextContainerKey, this.ownerID);
            this.depth++;
            this.containerKeys.push(nextContainerKey);
            this.containers.push(iContainer);
            nextContainerKey = iContainer.getRightmostChild();
        }
    }

    async split(maxElements) {
        var iContainer = this.containers[this.depth-1];
        var depth = this.depth;
        while(iContainer.numElements === maxElements) {
            const rightContainer = new TreeContainer();
            const meanElement = iContainer.split(rightContainer);
            const leftContainer = iContainer;
            const prevLeftContainerKey = this.containerKeys[depth-1];
            const newLeftContainerKey = await ResourcesManager.storeResourceObject(leftContainer);
            const rightContainerKey = await ResourcesManager.storeResourceObject(rightContainer);
            if(depth > 1) {
                depth--;
                iContainer = this.containers[depth-1];
                iContainer.updateChild(prevLeftContainerKey, newLeftContainerKey);
                iContainer.add(meanElement, rightContainerKey);
            } else {
                //ROOT SPLIT
                const newRoot = new TreeContainer(newLeftContainerKey);
                newRoot.add(meanElement, rightContainerKey);
                this.containerKeys.unshift('');
                this.containers.unshift(newRoot);
                this.depth++;
//					logger.log('info', "New tree root: " + JSON.stringify(newRoot, null , 2)
//						+ " -> " + this.containers[0]);
                break;
            }
        }
        return depth;
    }

    async rebalance(minElements) {
        var depth = this.depth;
        while(depth > 1) {
            const iContainerKey = this.containerKeys[depth-1]
            const iContainer = this.containers[depth-1];
            const parentContainer = this.containers[depth-2];
            debugger;
            if(iContainer.numElements < minElements) {
                debugger;
                const [leftSiblingKey, leftKey] = parentContainer.getLeftSibling(iContainerKey);
                const [rightSiblingKey, rightKey] = parentContainer.getRightSibling(iContainerKey);
                var leftSibling = {numElements:0};
                var rightSibling = {numElements:0};
                if(leftSiblingKey === '' && rightSiblingKey === '') {
                    throw Error('container has no siblings');
                }
                if(leftSiblingKey !== '') {
                    leftSibling = await TreeContainer.fromResource(leftSiblingKey, this.ownerID);
                }
                if(rightSiblingKey !== '') {
                    rightSibling = await TreeContainer.fromResource(rightSiblingKey, this.ownerID);
                }
                if(leftSibling.numElements >= rightSibling.numElements) {
                    if(leftSibling.numElements > minElements) {
                        //rotate from left
                        debugger;
                        const [rotatedKey, rotatedChildKey] = leftSibling.pop();
                        parentContainer.substituteKey(leftKey, rotatedKey);
                        const newLeftSiblingKey = await ResourcesManager.storeResourceObject(leftSibling);
                        parentContainer.updateChild(leftSiblingKey, newLeftSiblingKey);
                        iContainer.unshift(leftKey, rotatedChildKey);
                        const newContainerKey = await ResourcesManager.storeResourceObject(iContainer);
                        parentContainer.updateChild(iContainerKey, newContainerKey);
                    } else {
                        //merge around left key
                        debugger;
                        iContainer.mergeLeft(leftSibling, leftKey);
                        const mergedChildKey = await ResourcesManager.storeResourceObject(iContainer);
                        parentContainer.mergeChildren(leftKey, mergedChildKey);
                        debugger;
                    }
                } else {
                    if(rightSibling.numElements > minElements) {
                        //rotate from right
                        debugger;
                        const [rotatedKey, rotatedChildKey] = rightSibling.shift();
                        const newRightSiblingKey = await ResourcesManager.storeResourceObject(rightSibling);
                        parentContainer.updateChild(rightSiblingKey, newRightSiblingKey);
                        parentNode.substituteKey(rightKey, rotatedKey);
                        iContainer.push(rightKey, rightSiblingKey);
                    } else {
                        //merge around right key
                        debugger;
                        iContainer.mergeRight(rightSibling, rightKey);
                        const mergedChildKey = await ResourcesManager.storeResourceObject(iContainer);
                        parentContainer.mergeChildren(rightKey, mergedChildKey);
                    }
                }
                depth--;
                debugger;
            } else {
                break;
            }
        }
        return depth;
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
                if(this.key
                && this.key.search('xwOL') === 0) {
                    debugger;
                }
                this.containerKeys[depth-1] = newContainerKey;
                // if(prevContainerKey !== newContainerKey) {
                    parentContainer.updateChild(prevContainerKey, newContainerKey);
                // }
                depth--;
            }
            this.containerKeys[0] = await ResourcesManager.storeResourceObject(this.containers[0]);
        } else {
            this.depth = 0;
            this.containerKeys[0] = '';
        }
        return this.containerKeys[0];
    }
}
