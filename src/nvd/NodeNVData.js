/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const fs = require('fs');

const path = './nvdata.json';


export class NodeNVData {

	constructor() {

		this.loaded = false;

	}

	loadMap() {

		if(fs.existsSync(path)) {

			var serializedData = fs.readFileSync(path);

			try {

				this.data = new Map(JSON.parse(serializedData));

			} catch (err) {

				console.log('There has been an error parsing your JSON.')
				console.log(err);

				this.data = new Map();

			}

		} else {

			//No nvdata stored, create new
			this.data = new Map();

		}

		this.loaded = true;
	}

	saveMap() {

		var serializedData = JSON.stringify(Array.from(this.data.entries()));

		fs.writeFile(path, serializedData, function (err) {
			if (err) {
				console.log('There has been an error saving your configuration data.');
				console.log(err.message);
				return;
			}
			console.log('Configuration saved successfully.')
		});


	}

	save(key, data) {

		if(this.loaded === false) {
			this.loadMap();
		}

		this.data.set(key, data);

		this.saveMap();
	}

	load(key) {

		if(this.loaded !== true) {
			this.loadMap();
		}

		return this.data.get(key);

	}

};
