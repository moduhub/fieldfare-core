/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const VersionedData = require('./VersionedData.js');

module.exports = class Environment extends VersionedData {

	constructor(uuid) {
		super();
		
		//this.uuid = uuid;
		
		this.services = '';
		
		this.providers = '';
		
	}
	
	init(uuid) {
		
		const update = nvdata.load(uuid);
		
		//UpdateMessage.validate(update);?
		
		const envRoot = {
			uuid: uuid
		};
		
		//Build chain downto envRoot
		const chain = update.buildChain(envRoot);
		
	}
		
	updateProviderState(providerID, stateHash) {
		
		//provider state is a versioned state strucutre
		var currentStateObjectHash = this.getCurrentHostState(providerID);

	}
	
	addService(definition) {
		
		//
		
	}
	
	//Env alteration functions
	addServiceProvider(serviceName, providerID) {
		
		//check if service exists
		
		//add provider to list
		
	}
	
	removeServiceProvider(serviceName, providerID) {
		
		//
		
	}
	
};