var util = require('util');
var debug = require('debug')('qufox');
var Sockets = require('socket.io');

exports.QufoxServer = (function(){
	function QufoxServer (listenTarget, option, adapter) {
		var self = this;

		var io = Sockets(listenTarget, option);
		if (adapter) io.adapter(adapter);

		io.on('connection', function (socket){
			debug('connected - ' + ' (socketId: ' + socket.id + ' )');
			socket.emit('connected');
			
			socket.on('join', function (sessionId) {
				socket.join(sessionId);
				debug('joinSession -'+ ' (sessionId: ' + sessionId + ')');
				socket.emit('joinCallback', {id:sessionId, data:'success'});
			});

			socket.on('send', function (payload) {
				if (payload && payload.sessionId && payload.id) {
					debug('send -' + util.inspect(payload));
					socket.broadcast.to(payload.sessionId).emit('receive', {id:payload.sessionId, data:payload.data});
					socket.emit('sendCallback', {id:payload.id, data:'success'});
				}
			});

			socket.on('leave', function (sessionId) {
				socket.leave(sessionId);
				debug('leaveSession -'+ ' (sessionId: ' + sessionId + ')');
				socket.emit('leaveCallback', {id:sessionId, data:'success'});
			});

			socket.on('disconnect', function () {
				debug('disconnect - ' + ' (socketId: ' + socket.id + ' )');
			});
		});

		debug('Qufox server is running.');
	}

	return QufoxServer;
})();