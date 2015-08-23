var util = require('util');
var debug = require('debug')('qufox');
var Sockets = require('socket.io');
var tools = require('./tools');

exports.QufoxServer = (function(){
	function QufoxServer (options) {
		var self = this;

		if (typeof options == 'number') options = {listenTarget: options};		
		if (!options) options = {listenTarget:4000};
		
		var io = Sockets(options.listenTarget || 4000, options.socketOption);
		if (options.redisUrl) {
			 io.adapter(require('socket.io-redis')({
				pubClient : tools.createRedisClient(options.redisUrl, {return_buffers:true}),
				subClient : tools.createRedisClient(options.redisUrl, {return_buffers:true})
			}));
		}

		io.on('connection', function (socket){
			log('connected', {socketId:socket.id, client:socket.request.connection._peername});
			
			socket.emit('connected');
			
			socket.on('join', function (sessionId) {
				log('join', {socketId:socket.id, sessionId:sessionId});
				socket.join(sessionId);				
				socket.emit('joinCallback', {id:sessionId, data:'success'});
			});

			socket.on('send', function (payload) {
				if (payload && payload.sessionId && payload.id) {
					log('send', {socketId:socket.id, payload:payload});
					socket.broadcast.to(payload.sessionId).emit('receive', {id:payload.sessionId, data:payload.data});
					socket.emit('sendCallback', {id:payload.id, data:'success'});
				}
			});

			socket.on('leave', function (sessionId) {
				log('leave', {socketId:socket.id, sessionId:sessionId});
				socket.leave(sessionId);
				socket.emit('leaveCallback', {id:sessionId, data:'success'});
			});

			socket.on('disconnect', function () {
				log('disconnect', {socketId:socket.id});
			});
		});

		debug('Qufox server is running.');

		if (options.monitor && options.monitor.host && options.monitor.port){
			var QufoxMonitorClient = require('./QufoxMonitorClient').QufoxMonitorClient;
			self.monitor = new QufoxMonitorClient(options.monitor.host, options.monitor.port, io, options.instanceName);
		}

		function log(type, data) {
			debug(type + ' - ' + util.inspect(data, false, null, true));
			if (self.monitor) {
				self.monitor.sendData(type, data);
			}
		}
	}

	return QufoxServer;
})();
