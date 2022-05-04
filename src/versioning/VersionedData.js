/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const HashLinkedList = require('../structures/HashLinkedList.js');
const HashLinkedTree = require('../structures/HashLinkedTree.js');

const VersionStatement = require('./VersionStatement.js');
const VersionChain = require('./VersionChain.js');

const Utils = require('../basic/Utils.js');

class VersionedElements {

	constructor(contents) {

		if(contents) {
			this.contents = contents;
		} else {
			this.contents = {};
		}

	}

	addSet(name) {
		this.elements[name] = new HashLinkedTree(5);
	}

	addList(name) {
		this.elements[name] = new HashLinkedList();
	}

	getObjectProperty (object, path) {
	  	if (object == null) { // null or undefined
	    	return object;
	    }
	  	const parts = path.split('.');
		for (let i = 0; i < parts.length; ++i) {
	      	if (object == null) { // null or undefined
	        	return undefined;
	        }
	      	const key = parts[i];
	    	object = object[key];
	    }
	  	return object;
	}

	forEachObjectProperty(object, callback, path) {

		if(!path) {
			path = '';
		}

		for(const prop in object) {

			const value = object[prop];

			if(callback(path + key, value) === false) {
				if(value instanceof Object) {
					this.forEachObjectProperty(value, callback, path.push[prop]);
				} else {
					throw Error('invalid object passed to iterator');
				}
			}
		}
	}

	resetState() {

		this.forEachObjectProperty(this.elements, (path, value) => {

			if(value instanceof HashLinkedList
			|| value instanceof HashLinkedTree) {

				console.log('resetState of ' + path);
				const value = this.getObjectProperty(this.elements, path);

				value.setState('');
				return true;
			}

			return false;
		});
	}

	setState(state) {

		this.forEachObjectProperty(this.elements, (path, value) => {

			if(Utils.isBase64(value)) {
				console.log('setState of ' + path + ' to ' + value);

				const correspondingObject = this.getObjectProperty(this.elements, path);
				correspondingObject.setState(value);

				return true;
			}

			return false;
		});

	}

	static jsonReplacer(key, value) {

		if(value instanceof HashLinkedTree
		|| value instanceof HashLinkedList) {
			return value.getState();
		}

		return value;
	}

	getState() {

		//Store transformed
		const transformedState = JSON.parse(JSON.stringify(this.elements, VersionedElements.jsonReplacer));

		console.log("Transformed state: " + JSON.stringify(transformedState, null, 2));

		return transformedState;
	}

}

module.exports = class VersionedData {

	constructor() {

		this.elements = new VersionedElements();

		this.elements.addSet('admins');

		this.version = '';

	}

	async apply(issuer, method, params) {

		//handle addAdmin here
		switch(method) {
			case 'addAdmin' : {
				await this.applyAddAdmin(issuer, params);
			} break;

			default: {
				throw Error('apply failed: unknown change method ' + method);
			} break;
		}
	}

	async revertToVersion(version) {

		console.log("REVERTING TO VERSION: "  + version);

		const statement = await host.getResourceObject(version);

		const stateKey = statement.data.state;

		console.log("State key: \'" + stateKey + '\'');

		if(stateKey !== '') {

			const state = await host.getResourceObject(statement.data.state);

			console.log("Revert to state object: " + JSON.stringify(state));

			this.setState(state);

		} else {

			console.log('Reset state')
			console.log('state before reset: ' + JSON.stringify(await this.getState()));
			this.resetState(null);
			console.log('state after reset: ' + JSON.stringify(await this.getState()));

		}

		this.version = version;

	}

	async update(version, owner) {

		console.log("Received update version: " + version);

		const receivedMessage = await VersionStatement.fromResource(version, owner);

		console.log("Received update statement " + JSON.stringify(receivedMessage));

		var localChain = new VersionChain(this.version, host.id, 50);
		var remoteChain = new VersionChain(version, owner, 50);

		var commonVersion = await VersionChain.findCommonVersion(localChain, remoteChain);

		//Limit to commonVersion, not including
		localChain.limit(commonVersion, false);
		remoteChain.limit(commonVersion, false);

		console.log("Common version is " + commonVersion);

		const localCommitsAhead = await localChain.length();
		const remoteCommitsAhead = await remoteChain.length();

		console.log("Local env is " + localCommitsAhead + " commits ahead");
		console.log("Remote env is " + remoteCommitsAhead + " commits ahead");

		// 		1) I have concurrent changes
		// && 	2) remote chain is LoggerManager
		// 			so... stash localChanges and perform remote before
		if(remoteCommitsAhead > localCommitsAhead) {

			if(localCommitsAhead > 0) {
				console.log("Stashing local changes");
				await this.revertToVersion(commonVersion);
			}

			try {

				//just accept remote changes
				const remoteChanges = await remoteChain.getChanges();

				console.log("remoteChanges:" + JSON.stringify(remoteChanges));

				for await (const [issuer, method, params] of remoteChanges) {
					console.log('await this.apply('+ issuer + ',' + method + ',' + JSON.stringify(params) + ')');
					await this.apply(issuer, method, params);

					const stateKey = await host.storeResourceObject(await this.getState());
					console.log("state after apply: " + stateKey);

				}

				const stateKey = await host.storeResourceObject(await this.getState());
				const expectedState = await remoteChain.getHeadState();

				console.log("state after apply: " + stateKey);
				console.log("expected state: " + expectedState);

				if(stateKey !== expectedState) {
					throw Error('version mismatch after changes applied');
				}

				this.version = remoteChain.version;

				const localChanges = await localChain.getChanges();

				//now merge local changes at end of remote chain
				for await (const [method, params] of localChanges) {
					console.log('await this.change(' + method + ',' + JSON.stringify(params) + ')');
				}

			} catch (error) {

				// Recover previous state
				await this.revertToVersion(localChain.head);

				throw Error('environment changes apply all failed: ', {cause: error});

			}

		} else {

			console.log("Local chain is ahead of remote chain, nothing to do");

			//Local chain is ahead of remote, wait for remote to merge
			// Todo: notify him?
		}

	}

	async commit(changes) {

		//Create update message
		var versionStatement = new VersionStatement();

		versionStatement.source = host.id;

		const stateResource = await host.storeResourceObject(await this.getState());

		versionStatement.data = {
			prev: this.version,
			state: stateResource,
			changes: await host.storeResourceObject(changes)
		};

		await host.signMessage(versionStatement);

		this.version = await host.storeResourceObject(versionStatement);

		console.log("New version statement: " + JSON.stringify(versionStatement, null, 2)//.replaceAll('\\', '')
			+ "->" + this.version);

	}

	async auth(id, strict=true) {

		if(Utils.isBase64(id) == false) {
			throw Error('invalid id parameter');
		}

		const admins = this.elements.get('admins');

		if(await admins.isEmpty() !== false) {

			console.log("Checking if I am authorized");

			if(await admins.has(id) == false) {
				throw Error('addAdmin failed: not authorized');
			} else {
				console.log(">>> Auth ok");
			}

		} else {
			if(strict) {
				throw Error('strict auth failed, admin group empty');
			} else {
				console.log("Admin group is empty, strict=false, auth ok");
			}
		}
	}

	async applyAddAdmin(issuer, newAdminID) {

		//newAdmin must be a valid host ID
		console.log("APPLY >> VersionedData.applyAddAdmin ID=" + newAdminID
		 	+ ' from ' + issuer);

		const admins = this.elements.get('admins');

		console.log("Current admins: ")
		for await (const admin of admins) {
			console.log('> ' + admin);
		}

		//Check if admin was not already present
		if(await this.admins.has(newAdminID)) {
			throw Error('applyAddAdmin failed: id already in set');
		}

		//Check auth, non strict
		await this.auth(issuer, false);

		//Perform local changes
		await admins.add(newAdminID);

	}

	async addAdmin(newAdminID) {

		//newAdmin must be a valid host ID
		console.log("VersionedData.addAdmin ID="+newAdminID);

		await this.applyAddAdmin(host.id, newAdminID);

		await this.commit({
			addAdmin: newAdminID
		});

	}

};
