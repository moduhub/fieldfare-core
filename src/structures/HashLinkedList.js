/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


module.exports = class HashLinkedList {

	constructor(lastHash) {

		if(lastHash
		&& lastHash !== 'null'
		&& lastHash !== 'undefined'
		&& lastHash !== '') {

			this.lastHash = lastHash;

			console.log("WARNING: HLT num elements is wrong");
			this.numElements = undefined;

		} else {

			this.lastHash = '';
			this.numElements = 0;

		}


	}

	async append(element) {

		var newListElement = {
			prev: this.lastHash,
			obj: element
		};

		this.lastHash = await host.storeResourceObject(newListElement);

		this.numElements++;

	}

	async forEach(callback) {

		if(callback) {

			var prevHash = this.lastHash;

			while(prevHash !== '') {

				var listElement = await host.getResourceObject(prevHash);

				//console.log("forEachResult hash ("+prevHash+"):" + JSON.stringify(object));

				if(listElement
				&& listElement !== 'null'
				&& listElement !== 'undefined') {

					callback(listElement.obj);

					var prevHash = listElement.prev;

				} else {

					console.log("HashLinkedList: resource fetch failed");
					break;
				}

			}
		}
	}

};
