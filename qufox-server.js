const util = require('util');
const EventEmitter = require('events');
const debug = require('debug')('qufox');
const Sockets = require('socket.io');
const tools = require('./tools');

/**
 * Qufox server class.
 */
class QufoxServer extends EventEmitter {
  /**
   * Qufox server constructor.
   * @param {*} options server option.
   */
  constructor(options) {
    super();
    this.options = options;
    // set default options.
    if (typeof options == 'number') options = { listenTarget: options };
    if (!options) options = { listenTarget: 4000 };
    if (!options.socketOption) options.socketOption = {};
    if (!options.socketOption.path) options.socketOption.path = '/qufox.io';

    // if option has redisUrl, create redis adapter and runServer.
    if (options.redisUrl) tools.createRedisAdapter(options.redisUrl, adapter => this._runServer(adapter));
    // if option has redisSentinel, create redis sentinel adapter and runServer.
    else if (options.redisSentinel) tools.createRedisSentinelAdapter(options.redisSentinel,  adapter => this._runServer(adapter));
    // run without adapter.
    else this._runServer();
  }

  /**
   * run server
   * @param {Adapter} adapter socket.io adapter
   */
  _runServer(adapter) {
    // create SocketIO.Server.
    this.io = Sockets(this.options.listenTarget || 4000, this.options.socketOption);
    // set adapter. (for multi node server)
    if (adapter) this.io.adapter(adapter);
    // on connection - new client connected.
    this.io.on('connection', socket => this._onConnection(socket));
    // on linstening - server is ready.
    this.io.httpServer.on('listening', () => this._onListening());
    // on close - server is closed.
    this.io.httpServer.on('close', () => this._onClose());
    
    debug('Qufox server is running.');
  }

  /**
   * on connection - new client connected.
   * @param {SocketIO.Socket} socket connected socket
   */
  _onConnection(socket) {
    this._log('connected', { socketId: socket.id, client: socket.request.connection._peername });
    socket.emit('connected');
    socket.on('join', (payload) => this._onJoin(socket, payload));
    socket.on('send', (payload) => this._onSend(socket, payload));
    socket.on('leave', (payload) => this._onLeave(socket, payload));
    socket.on('disconnect', () => this._onDisconnect(socket));
  }

  /**
   * on join - client request join session.
   * @param {SocketIO.Socket} socket connected socket
   * @param {*} payload qufox payload
   */
  _onJoin(socket, payload) {
    this._log('join', { socketId: socket.id, sessionId: payload.sessionId });
    socket.join(payload.sessionId);
    socket.emit('callback', { id: payload.id, data: 'success' });
  }

  /**
   * on send - client request sed message on session.
   * @param {SocketIO.Socket} socket connected socket
   * @param {*} payload qufox payload
   */
  _onSend(socket, payload) {
    // check payload and session exsits.
    if (payload && payload.sessionId && payload.id) {
      this._log('send', { socketId: socket.id, payload: payload });
      if (payload.echo){ // if echo flag is true, send message to all session members. (include sender.)
        this.io.sockets.in(payload.sessionId).emit('receive', { id: payload.sessionId, data: payload.data });
      }
      else{ // if echo flag is false, broadcast message on session. (exclude sender.)
        socket.broadcast.to(payload.sessionId).emit('receive', { id: payload.sessionId, data: payload.data });
      }
      // response callback to sender.
      socket.emit('callback', { id: payload.id, data: 'success' });
    }
  }

  /**
   * on join - client request leave session.
   * @param {SocketIO.Socket} socket connected socket
   * @param {*} payload qufox payload
   */
  _onLeave(socket, payload) {
    this._log('leave', { socketId: socket.id, sessionId: payload.sessionId });
    // leave session.
    socket.leave(payload.sessionId);
    // response callback to sender.
    socket.emit('callback', { id: payload.id, data: 'success' });
  }

  /**
   * on connection - client disconnected.
   * @param {SocketIO.Socket} socket connected socket
   */
  _onDisconnect(socket) {
    this._log('disconnect', { socketId: socket.id });
  }

  /**
   * on listening - server is ready.
   */
  _onListening() {
    // emit event.
    this.emit('listening');
    debug('server is listening.');
  }

  /**
   * on close - server is closed.
   */
  _onClose() {
    // emit event.
    this.emit('close');
    debug('server is closed.');
  }
  
  /**
   * log.
   * @param {String} type log type.
   * @param {*} data log data.
   */
  _log(type, data) {
    debug(type + ' - ' + util.inspect(data, false, null, true));
  }

  /**
   * close server.
   */
  close() {
    if (this.io) this.io.close();
  }
}

/**
 * export module.
 */
module.exports = QufoxServer;