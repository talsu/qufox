
var net = require('net');
var util = require('util');
var debug = require('debug')('qufox:monitor');
var tools = require('./tools');
var hostname = require("os").hostname();

exports.QufoxMonitorClient = (function(){
	function QufoxMonitorClient (host, port, io, instanceName) {		
		var self = this;
		self.instanceName = instanceName;
		self.instanceId = tools.randomString(8);
		debug('Start connecting monitor server - ' + host + ':' + port);
		connect(host, port, connectCallback);

		self.sendQueue = [];

		function connect (host, port, callback) {
			var socket = net.connect({host:host, port:port}, function(){
				if (callback) callback(socket);
			})
			
			socket.on('error', function (err){
				if (err.code == 'ECONNREFUSED' || err.code == 'ETIMEDOUT') {
					debug('Socket error : '+ err.code +' - retry connect to ' + host + ':' + port);
					setTimeout(function () { connect(host, port, callback); }, 1000);
				}
				else {
					debug('Socket Error : ' + util.inspect(err, false, null, true));
				}
			});
		}

		function connectCallback(socket) {
			debug('Connected to ' + host + ':' + port);
			self.socket = socket;
			self.isConnected = true;

			socket.on('data', function (data) {
				debug(data.toString());				
			});			
			socket.on('timeout', function() {
				debug('Socket Timed Out');
			});
			socket.on('close', function() {
				debug('Socket Closed');
				self.isConnected = false;
				self.socket = null;
				connect(host, port, connectCallback);
			});			
			socket.on('end', function() {
				debug('Disconnected from ' + host + ':' + port);
			});
			
			if (self.sendQueue.length > 0) self.sendQueueData();
		 	self.sendData('instanceInfo', {				
				instanceName: self.instanceName,
				hostname: hostname,
				pid: process.pid
			});
			self.sendData('sessionList', io.sockets.adapter.rooms);
		}
	}

	QufoxMonitorClient.prototype.sendData = function (type, data) {
		var self = this;
		var telegram = {
			type: type, 
			time: new Date().getTime(),
			instanceId: self.instanceId, 
			data: data
		};

		var packet = createPacket(telegram);

		if (self.isConnected && self.socket) {
			if (self.sendQueue.length > 0) self.sendQueueData();
			writeData(self.socket, packet);
		}
		else {			
			self.sendQueue.push(packet);
			debug('Server disconnected ... Enqueue packet. Queue length: ' + self.sendQueue.length);
		}
	};

	QufoxMonitorClient.prototype.sendQueueData = function () {
		var self = this;
		if (self.isConnected && self.socket) {
			debug('Start send queue data ... Queue length: ' + self.sendQueue.length);

			while (self.sendQueue.length > 0) writeData(self.socket, self.sendQueue.shift());

			debug('Snd queue data complete.');
		}
	};

	function createPacket(data){
		var payloadBuffer = new Buffer(JSON.stringify(data), 'utf8');
		var headerBuffer = new Buffer(8);
		headerBuffer.writeUIntBE(payloadBuffer.length, 0, 8);
		return Buffer.concat([headerBuffer, payloadBuffer]);
	}

	function writeData(socket, packet){
		var success = socket.write(packet);
		if (success){
			debug("Send packet ... " + packet.length + " bytes");
		}
		else{
			debug("Send packet at once fail ... wait drain");
			(function(socket, packet){
				socket.once('drain', function(){
					debug("Drain");					
					writeData(socket, packet);
				});
			})(socket, packet);
		}
	}

	return QufoxMonitorClient;
})();