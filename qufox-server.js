var util = require('util');
var debug = require('debug')('qufox');
var Sockets = require('socket.io');
var tools = require('./tools');

exports.QufoxServer = (function () {
  function QufoxServer(options) {
    var self = this;

    if (typeof options == 'number') options = { listenTarget: options };
    if (!options) options = { listenTarget: 4000 };
    if (!options.socketOption) options.socketOption = {};
    if (!options.socketOption.path) options.socketOption.path = '/qufox.io';

    var io = Sockets(options.listenTarget || 4000, options.socketOption);
    if (options.redisUrl) {
      io.adapter(require('socket.io-redis')({
        pubClient : tools.createRedisClient(options.redisUrl, { return_buffers: true }),
        subClient : tools.createRedisClient(options.redisUrl, { return_buffers: true })
      }));
    }
    else if (options.redisSentinel) {
      io.adapter(require('socket.io-redis')({
        pubClient : tools.createRedisSentinelClient(options.redisSentinel, { return_buffers: true }),
        subClient : tools.createRedisSentinelClient(options.redisSentinel, { return_buffers: true })
      }));
    }

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

    debug('Qufox server is running.');

    function log(type, data) {
      debug(type + ' - ' + util.inspect(data, false, null, true));
    }
  }

  return QufoxServer;
})();
