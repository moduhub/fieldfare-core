/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {bytesToBase64, base64ToBytes} from './base64.js';

export const Utils = {

	ab2str: function (buf) {
		return String.fromCharCode.apply(null, new Uint16Array(buf));
	},

	str2ab: function (str) {
		var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
		var bufView = new Uint16Array(buf);
		for (var i=0, strLen=str.length; i < strLen; i++) {
			bufView[i] = str.charCodeAt(i);
		}
		return buf;
	},

	hex2ab: function (str) {
		//var buf = new ArrayBuffer(str.length/2);
		var typedArray = new Uint8Array(str.match(/[\da-f]{2}/gi).map(function (h) {
			return parseInt(h, 16)
		}))
		return typedArray.buffer;
	},

	ab2hex: function (buffer) { // buffer is an ArrayBuffer
		return [...new Uint8Array(buffer)]
			.map(x => x.toString(16).padStart(2, '0'))
			.join('');
	},

	base64ToUint8Array: base64ToBytes,

	base64ToArrayBuffer: function (base64) {
		const uint8Array = Utils.base64ToUint8Array(base64);
		return uint8Array.buffer;
	},

	base64ToHex: function (str) {
	  const raw = atob(str);
	  let result = '';
	  for (let i = 0; i < raw.length; i++) {
	    const hex = raw.charCodeAt(i).toString(16);
	    result += (hex.length === 2 ? hex : '0' + hex);
	  }
	  return result.toUpperCase();
  	},

	uint8ArrayToBase64: bytesToBase64,

	arrayBufferToBase64: function (buffer) {
		if(buffer instanceof ArrayBuffer === false) {
			throw Error('Expected an instance of ArrayBuffer, but received ' + buffer.constructor.name);
		}
		var uint8Array = new Uint8Array( buffer );
		return Utils.uint8ArrayToBase64(uint8Array);
	},

	isBase64(str) {
		if (typeof str !== 'string'
		&& str instanceof String === false) {
			return false;
		}
		if (str ==='' || str.trim() ==='') {
			return false;
		}
		var base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
		return base64regex.test(str);
	},

	validateParameters(params, mandatory, optional=[]) {
		for(const prop in params) {
			if(mandatory.includes(prop) === false
			&& optional.includes(prop) === false) {
				throw Error('validation failed, unexpected parameter: ' + prop);
			}
		}
		for(const name of mandatory) {
			if(name in params === false) {
				throw Error('validation failed, missing mandatory parameter: ' + name);
			}
		}
	},

	isUUID(uuid) {
        var pattern = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', 'i');
        return pattern.test(uuid);
    },

	/**
	 * Regular expression to check if string is a IPv4 address
	 * @param string String to be verified
	 * @return true if the string is an IPv4 address, false otherwise
	 */
	isIPV4(string) {

		const regexExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
		return regexExp.test(string); // true
	},

	isIterable(obj) {
  		if(obj === undefined
		|| obj === null) {
    		return false;
  		}
  		return typeof obj[Symbol.iterator] === 'function';
	},

	strToUtf8Array(str){
		var utf8ArrayBuffer = new Uint8Array(str.length);
		for (var i = 0; i < str.length; i++) {
			utf8ArrayBuffer[i] = str.charCodeAt(i);
		}
		return utf8ArrayBuffer;
	}

};
