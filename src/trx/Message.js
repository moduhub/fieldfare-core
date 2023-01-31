/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

export class Message {

	constructor(service, data) {
		this.service = service;
		this.data = data;
	}

	setDestinationAddress(address) {
		this.destination = address;
	}

	setSourceAddress(address) {
		this.source = address;
	}

	jsonReplacer(key, value) {
		//Add propertires to be ignored or transformed
		// when stringifying the message for tansmission here
		return value;
	}

};
