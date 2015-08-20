
var net = require('net');
var util = require('util');
var debug = require('debug')('qufox:monitor');

exports.QufoxMonitorClient = (function(){
	function QufoxMonitorClient (host, port, io) {

		var self = this;
		debug('Start connecting monitor server - ' + host + ':' + port);
		connect(host, port, connectCallback);

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
			
		 	self.sendData('sessionList', io.sockets.adapter.rooms);
		}
	}

	QufoxMonitorClient.prototype.sendData = function (header, payload) {
		var self = this;
		if (self.isConnected && self.socket)
		{
			writeData(self.socket, JSON.stringify({header:header, payload:payload}));
		}
	};

	function writeData(socket, data){
		var success = socket.write(data);
		if (!success){
			debug("write data at once fail ... wait drain");
			(function(socket, data){
				socket.once('drain', function(){
					debug("Drain");					
					writeData(socket, data);
				});
			})(socket, data);
		}
	}

	return QufoxMonitorClient;
})();