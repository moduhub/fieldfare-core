/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.

 */

import {ResourcesManager} from '../resources/ResourcesManager'
import {Utils} from '../basic/Utils';
import {logger} from '../basic/Log';


export class HashLinkedList {

	constructor(lastHash) {

		if(lastHash
		&& lastHash !== 'null'
		&& lastHash !== 'undefined'
		&& lastHash !== '') {

			if(Utils.isBase64(lastHash) === false) {
				throw Error('invalid HLL initialization parameter');
			}

			this.lastHash = lastHash;

			logger.log('warning', "WARNING: HLT num elements is wrong");
			this.numElements = undefined;

		} else {

			this.lastHash = '';
			this.numElements = 0;

		}

	}

	setState(state) {

		if(state === null
		|| state === undefined
		|| state === '') {

			this.lastHash = '';

		} else {

			if(Utils.isBase64(state) === false) {
				throw Error('lastHash is not base64');
			}

			this.lastHash = state;

		}

	}

	getState() {

		var stateId = this.lastHash;

		return stateId;
	}

	async append(element) {

		var newListElement = {
			prev: this.lastHash,
			obj: element
		};

		// logger.log('info', "Hash Linked List append: " + JSON.stringify(newListElement));

		this.lastHash = await ResourcesManager.storeResourceObject(newListElement);

		this.numElements++;

		// logger.log('info', "hash after append: " + this.lastHash);

	}

	async* [Symbol.asyncIterator]() {

		var prevHash = this.lastHash;

		while(prevHash !== '') {

			var listElement = await ResourcesManager.getResourceObject(prevHash);

			if(listElement === null
			|| listElement === undefined) {
				throw Error('HashLinkedList: resource is null or undefined');
			}

			yield listElement.obj;

			var prevHash = listElement.prev;
		}

	}

};
