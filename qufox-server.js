var util = require('util');
var EventEmitter = require('events');
var debug = require('debug')('qufox');
var Sockets = require('socket.io');
var tools = require('./tools');

module.exports = (function () {
  function QufoxServer(options) {
    var self = this;
    if (typeof options == 'number') options = { listenTarget: options };
    if (!options) options = { listenTarget: 4000 };
    if (!options.socketOption) options.socketOption = {};
    if (!options.socketOption.path) options.socketOption.path = '/qufox.io';

    if (options.redisUrl) tools.createRedisAdapter(options.redisUrl, runServer);
    else if (options.redisSentinel) tools.createRedisSentinelAdapter(options.redisSentinel, runServer);
    else runServer();

    function runServer(adapter){
      var io = Sockets(options.listenTarget || 4000, options.socketOption);
      self._io = io;
      if (adapter) io.adapter(adapter);

      io.on('connection', function (socket) {
        log('connected', { socketId: socket.id, client: socket.request.connection._peername });

        socket.emit('connected');

        socket.on('join', function (payload) {
          log('join', { socketId: socket.id, sessionId: payload.sessionId });
          socket.join(payload.sessionId);
          socket.emit('callback', { id: payload.id, data: 'success' });
        });

        socket.on('send', function (payload) {
          if (payload && payload.sessionId && payload.id) {
            log('send', { socketId: socket.id, payload: payload });
            if (payload.echo)
            io.sockets.in(payload.sessionId).emit('receive', { id: payload.sessionId, data: payload.data });
            else
            socket.broadcast.to(payload.sessionId).emit('receive', { id: payload.sessionId, data: payload.data });
            socket.emit('callback', { id: payload.id, data: 'success' });
          }
        });

        socket.on('leave', function (payload) {
          log('leave', { socketId: socket.id, sessionId: payload.sessionId });
          socket.leave(payload.sessionId);
          socket.emit('callback', { id: payload.id, data: 'success' });
        });

        socket.on('disconnect', function () {
          log('disconnect', { socketId: socket.id });
        });
      });

      io.httpServer.on('listening', function (){
        self.emit('listening');
        debug('server is listening.');
      });

      io.httpServer.on('close', function (){
        self.emit('close');
        debug('server is closed.');
      });

      debug('Qufox server is running.');
    }

    function log(type, data) {
      debug(type + ' - ' + util.inspect(data, false, null, true));
    }
  }

  util.inherits(QufoxServer, EventEmitter);
  
  QufoxServer.prototype.close = function (callback){
    if (this._io)
      this._io.close();
  };

  return QufoxServer;
})();
