
var net = require('net');
var util = require('util');
var debug = require('debug')('qufox:monitor');

exports.QufoxMonitorClient = (function(){
	function QufoxMonitorClient (host, port, io) {
		//var net = require('net');

		// var client = net.connect({host:host, port:port}, function() { //'connect' listener
		// 	console.log('client connected');
		// 	client.write('world!\r\n');
		// });

		// client.on('error', function (err){
		// 	console.log(err);
		// });

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
			socket.on('data', function (data) {
				debug(data.toString());
				//client.end();
			});
			socket.on('error', function(err) {
				debug('Socket Error : ' + util.inspect(err, false, null, true));
			});
			socket.on('timeout', function() {
				debug('Socket Timed Out');
			});
			socket.on('close', function() {
				debug('Socket Closed');
				connect(host, port, connectCallback);
			});			
			socket.on('end', function() {
				debug('Disconnected from ' + host + ':' + port);
			});
			
		 	writeData(socket, {type:'sessionList', sessionList:io.sockets.adapter.rooms});		
		}

		function writeData(socket, obj){
			var data = JSON.stringify(obj);
			var success = !socket.write(data);
			if (!success){
				(function(socket, data){
					socket.once('drain', function(){
						writeData(socket, data);
					});
				})(socket, data);
			}
		}
	}

	return QufoxMonitorClient;
})();