/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const fs = require('fs');

module.exports = class NodeNVData {

	constructor() {
		
		this.loaded = false;
		
	}
	
	loadMap() {
		
		var serializedData = fs.readFileSync('./nvdata.json');

		try {

			this.data = new Map(JSON.parse(serializedData));

		} catch (err) {

			console.log('There has been an error parsing your JSON.')
			console.log(err);

		}

		this.loaded = true;
	}
	
	saveMap() {

		var serializedData = JSON.stringify(Array.from(this.data.entries()));
		
		fs.writeFile('./nvdata.json', serializedData, function (err) {
			if (err) {
				console.log('There has been an error saving your configuration data.');
				console.log(err.message);
				return;
			}
			console.log('Configuration saved successfully.')
		});
		
		
	}
	
	save(key, data) {
		
		if(!this.loaded) {
			this.loadMap();
		}
		
		this.data.set(key, data);

		this.saveMap();
	}
	
	load(key) {
		
		if(this.loaded == false) {
			this.loadMap();
		}
		
		return this.data.load(key, data);
		
	}
	
};
