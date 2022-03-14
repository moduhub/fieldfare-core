/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

module.exports = class VersionedState {
	
	// Source: pointer to a RemoteHost object that maintains the state source
	// CurrentVersion: hash of the latest state object
	
	constructor(source, currentVersion) {
		
		this.source = source;
		this.currentVersion = currentVersion;
		
	}
	
	async validateStateMessage(message) {
		
		if('data' in message === false
		|| 'signature' in message === false) {
			throw 'malformed state object';
		} else 
		if('prev' in message.data
		|| 'current' in message.data) {
			throw 'malformed state.data object';
		}
		
		//Check state signature, must be signed by source
		if(this.source.verifyMessage(message) === false) {
			throw 'invalid signature';
		}
		
	}
	
	async update(newVersion) {
		
		try {
			
			if(this.currentVersion !== null) {
				throw 'init error: no previous state defined';
			}

			var iStateMessage = await host.getResource(	newVersion,
									this.sourceID);

			await this.validateStateMessage(iStateMessage);
			
			//Check if new state is more recent
			var iStateData = iStateMessage.data;

			while(iStateData.prev != '') {

				if(iStateData.prev === this.currentVersion) {

					//ok! new state is part of state chain, accept

					this.currentVersion = newVersion;

					break;
				}

				iStateMessage = host.getResource(iState.prev, this.sourceID);
				
				await this.validateStateMessage(iStateMessage);
				
				iStateData = iStateMessage.data;
			}

			if(iStateData.prev == '') {
				//state rejected, not part of the state chain
				throw 'state not in chain';
			}
	
			
		} catch (error) {
			
			console.log("State update failed: " + error);
			
		}

	}
};
