/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
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
