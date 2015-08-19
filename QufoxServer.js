var util = require('util');
var debug = require('debug')('qufox');
var Sockets = require('socket.io');
var tools = require('./tools');

exports.QufoxServer = (function(){
	function QufoxServer (listenTarget, option, redisUrl, monitor) {
		var self = this;

		var io = Sockets(listenTarget, option);
		if (redisUrl) {
			 io.adapter(require('socket.io-redis')({
				pubClient : tools.createRedisClient(redisUrl, {return_buffers:true}),
				subClient : tools.createRedisClient(redisUrl, {return_buffers:true})
			}));
		}

		io.on('connection', function (socket){
			debug('connected - ' + util.inspect({socketId:socket.id, client:socket.request.connection._peername}, false, null, true));
			socket.emit('connected');
			
			socket.on('join', function (sessionId) {
				debug('join - ' + util.inspect({socketId:socket.id, sessionId:sessionId}, false, null, true));
				socket.join(sessionId);				
				socket.emit('joinCallback', {id:sessionId, data:'success'});
			});

			socket.on('send', function (payload) {
				if (payload && payload.sessionId && payload.id) {
					debug('send - ' + util.inspect({socketId:socket.id, payload:payload}, false, null, true));
					socket.broadcast.to(payload.sessionId).emit('receive', {id:payload.sessionId, data:payload.data});
					socket.emit('sendCallback', {id:payload.id, data:'success'});
				}
			});

			socket.on('leave', function (sessionId) {
				debug('leave - ' + util.inspect({socketId:socket.id, sessionId:sessionId}, false, null, true));//
				socket.leave(sessionId);
				socket.emit('leaveCallback', {id:sessionId, data:'success'});
			});

			socket.on('disconnect', function () {
				debug('disconnect - ' + util.inspect({socketId:socket.id}, false, null, true));
			});
		});

		debug('Qufox server is running.');

		if (monitor && monitor.host && monitor.port){
			self.monitor = new require('./QufoxMonitorClient').QufoxMonitorClient(monitor.host, monitor.port, io);
		}
	}

	return QufoxServer;
})();
