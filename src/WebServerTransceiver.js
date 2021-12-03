/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const Transceiver = require('./Transceiver.js');
const WebSocketServer  = require('websocket').server;
const http = require('http');

module.exports = class WebServerTransceiver extends Transceiver {
	
	constructor(port) {
		super();
		
		this.port = port;
		
		this.server = http.createServer((request, response) => {
			this.treatHttpRequest(request, response);
		});
				
		this.wsServer = new WebSocketServer({
			httpServer: this.server,
			// You should not use autoAcceptConnections for production
			// applications, as it defeats all standard cross-origin protection
			// facilities built into the protocol and the browser.  You should
			// *always* verify the connection's origin and decide whether or not
			// to accept it.
			autoAcceptConnections: false
		});
		
		this.wsServer.on('request', (request) => {
			this.treatWsRequest(request);
		});
	}
	
	open() {
		
		this.server.listen(this.port, () => {
			console.log((new Date()) + ' Server is listening on port ' + this.port);
		});
		
	}
	
	treatHttpRequest(request, response) {
		
		console.log((new Date()) + ' Received request for ' + request.url);
		response.writeHead(404);
		response.end();
		
	}
	
	originIsAllowed(origin) {
		return true;
	}
	
	treatWsRequest(request) {
	
		if (!this.originIsAllowed(request.origin)) {
			// Make sure we only accept requests from an allowed origin
			request.reject();
			console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
			return;
		}
    
		var connection = request.accept('echo-protocol', request.origin);
			
		console.log((new Date()) + ' Connection accepted.');
			
		connection.on('message', function(message) {
			
			if (message.type === 'utf8') {
				console.log('Received Message: ' + message.utf8Data);
				connection.sendUTF(message.utf8Data);
			} else if (message.type === 'binary') {
				console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
				connection.sendBytes(message.binaryData);
			}
		});
		
		connection.on('close', function(reasonCode, description) {
			console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
		});
		
	}
};