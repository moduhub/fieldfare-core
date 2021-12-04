/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Transceiver = require('./Transceiver.js');

module.exports = class WebClientTransceiver extends Transceiver {
	
	constructor() {
		super();
		
		// Create WebSocket connection.
		const socket = new WebSocket('ws://localhost:8080');

		// Connection opened
		socket.addEventListener('open', function (event) {
		    socket.send('Hello Server!');
		});

		// Listen for messages
		socket.addEventListener('message', function (event) {
		    console.log('Message from server ', event.data);
		});
	}
};
