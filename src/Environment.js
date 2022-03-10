/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


module.exports = class Environment {

	constructor() {
		
		this.lastHash = '';
		
		this.admins = new Set();
		
		this.services = new Set();
		
		this.states = new Map();
		
	}
	
	init(envRoot) {
		
		console.log("Init environment from root:" + JSON.stringify(envRoot));
		
		//Store all admins
		envRoot.admins.forEach((hostid) => {
			
			if(hostid != host.id) {
				
				var newHost = host.registerRemoteHost(hostid);
				
				this.admins.add(newHost);
				
			} else {
				
				console.log("heh, found meeself in admin list");
				
			}
			
		});
		
		//Update env from remote hosts data
	}
		
	sync(newEnvState) {
		
		//Check if this object is a valid continuation of the state chain
		
	}
		
	updateProviderState(providerID, stateHash) {
		
		var newStateObject = host.getResource(stateHash, providerID);
		
		var currentStateObjectHash = this.getCurrentHostState(providerID);
		
		if(currentStateObjectHash != null) {
		
			var iState = newStateObject;
		
			while(iState.prev != '') {

				if(iState.prev == currentStateObjectHash) {
					
					//ok! new state is part of state chain, accept
					
					this.setCurrentHostState(providerID, stateHash);
					
					break;
				}

				//check if new state is older
				iState = host.getResource(iState.prev, providerID);
			}
			
			if(iState.prev == '') {
				//state rejected, not part of the state chain
			}
			
		} else {
			//No previous information from this host, accept anything
			this.setCurrentHostState(providerID, stateHash);
		}
		
	}
	
	//Env alteration functions
	addServiceProvider(serviceName, providerID) {
		
		//
		
	}
	
	removeServiceProvider(serviceName, providerID) {
		
		//
		
	}
	
};