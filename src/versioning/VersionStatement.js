/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

module.exports = class VersionStatement {

	constructor() {
		this.signature = '';
		this.source = '';
		this.data = {
			prev: ''
		};
	}

	static validate(message) {

		if(!message) {
			throw 'message is null';
		}

		if('signature' in message === false
		|| 'source' in message === false
		|| 'data' in message === false) {
			throw 'malformed update message';
		}

		if('prev' in message.data === false
		|| 'vdata' in message.data === false
		|| 'changes' in message.data === false) {
			throw 'malformed update message data';
		}

	}

	static async fromResource(hash, source) {

		const resourceObject = await host.getResourceObject(hash, source);

		VersionStatement.validate(resourceObject);

		var newMessage = new VersionStatement();

		Object.assign(newMessage, resourceObject);

		return newMessage;
	}

	static createRoot(uuid) {

		var rootVersion = new VersionStatement();

		rootVersion.data = {
			prev: '',
			vdata: '',
			changes: {
				uuid: uuid
			}
		};

		console.log("Root version: " + JSON.stringify(rootVersion, null, 2));

		return rootVersion;

	}

};
