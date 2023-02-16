/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import { Chunk } from "../chunking/Chunk";

export class Message {

	constructor(service, data) {
		this.service = service;
		this.data = data;
	}

	/**
	 * Substitute chunks, hosts and any other dedicated objects by their identifiers,
	 * is a way that the message always hashes to the same value independent of
	 * any chunk expansion.
	 * @param {message} message 
	 * @returns a normalized copy of the message
	 */
	static async normalize(message) {
		const normalizedMessage = new Object;
		Object.assign(normalizedMessage, message);
		await Chunk.replaceChunks(normalizedMessage, (key, value) => {
            return value.id;
        })
		return normalizedMessage;
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
