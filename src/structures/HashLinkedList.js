/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.

 */

const Utils = require('../basic/Utils.js');


module.exports = class HashLinkedList {

	constructor(lastHash) {

		if(lastHash
		&& lastHash !== 'null'
		&& lastHash !== 'undefined'
		&& lastHash !== '') {

			if(Utils.isBase64(lastHash) === false) {
				throw 'invalid HLL initialization parameter';
			}

			this.lastHash = lastHash;

			console.log("WARNING: HLT num elements is wrong");
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

		// console.log("Hash Linked List append: " + JSON.stringify(newListElement));

		this.lastHash = await host.storeResourceObject(newListElement);

		this.numElements++;

		// console.log("hash after append: " + this.lastHash);

	}

	async* [Symbol.asyncIterator]() {

		var prevHash = this.lastHash;

		while(prevHash !== '') {

			var listElement = await host.getResourceObject(prevHash);

			if(listElement === null
			|| listElement === undefined) {
				throw Error('HashLinkedList: resource is null or undefined');
			}

			yield listElement.obj;

			var prevHash = listElement.prev;
		}

	}

};
