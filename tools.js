var redis = require("ioredis");
var util = require('util');
var debug = require('debug')('qufox');

exports.setRedisAdapter = function (io, option) {
  var pubClient = createRedisClient(option, { return_buffers: true });
  var subClient = createRedisClient(option, { return_buffers: true });
  setRedisClientKeepAlivePing(pubClient);
  setRedisClientKeepAlivePing(subClient);
  setRedisEventLog(pubClient, 'PUB');
  setRedisEventLog(subClient, 'SUB');
  io.adapter(require('socket.io-ioredis')({
    pubClient : pubClient,
    subClient : subClient
  }));
};

exports.setRedisSentinelAdapter = function (io, option) {
  var pubSentinelClient = createRedisSentinelClient(option, { return_buffers: true });
  var subSentinelClient = createRedisSentinelClient(option, { return_buffers: true });
  setRedisClientKeepAlivePing(pubSentinelClient);
  setRedisClientKeepAlivePing(subSentinelClient);
  setRedisEventLog(pubSentinelClient, 'PUB');
  setRedisEventLog(subSentinelClient, 'SUB');
  io.adapter(require('socket.io-ioredis')({
    pubClient : pubSentinelClient,
    subClient : subSentinelClient
  }));
};

function createRedisClient (redisUrl, option) {
  debug('CreateRedisClient - ' + redisUrl);
  return new redis(redisUrl);
  // if (redisUrl) {
  //   var rtg = require("url").parse(redisUrl);
  //   var redisClient = redis.createClient(rtg.port || 6379, rtg.hostname, option);
  //   if (rtg.auth) {
  //     var authString = rtg.auth;
  //     if (authString.indexOf(':') !== -1) {
  //       authString = authString.split(":")[1];
  //     }
  //
  //     redisClient.auth(authString);
  //   }
  //
  //   return redisClient;
  // }
  // else {
  //   return redis.createClient("127.0.0.1", 6379, option);
  // }
}

function createRedisSentinelClient  (sentinelConfig, option) {
  debug('CreateRedisSentinelClient - ' + util.inspect(sentinelConfig, false, null, true));
  return new redis({sentinels:sentinelConfig.endpoints, name:sentinelConfig.masterName});
  // if (sentinelConfig && sentinelConfig.endpoints && sentinelConfig.masterName) {
  //   return require('redis-sentinel').createClient(sentinelConfig.endpoints, sentinelConfig.masterName, option);
  // }
}

function setRedisEventLog (redisClient, tag){
  redisClient.on('ready', function () { debug('REDIS[' + tag + '] - ready'); });
  redisClient.on('connect', function () {debug('REDIS[' + tag + '] - connect ');});
  redisClient.on('error', function (err) {debug('REDIS[' + tag + '] - error : ' + util.inspect(err));});
  redisClient.on('end', function () {debug('REDIS[' + tag + '] - end');});
  redisClient.on('close', function () {debug('REDIS[' + tag + '] - close');});
  redisClient.on('reconnecting', function () {debug('REDIS[' + tag + '] - reconnecting');});

  return redisClient;
}

function setRedisClientKeepAlivePing (redisClient){
  var pingTimer = null;
  redisClient.on('ready', function () {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
      debug('clear exists ping timer.');
    }

    pingTimer = setInterval(function(){
      redisClient.ping(function(err, result){
        if (err){
          debug('REDIS - ping error ' + util.inspect(err));
          debug(util.inspect(result));
        }
      });
    }, 10000);

    debug('redis ping timer created.');
  });

  redisClient.on('end', function(){
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
      debug('remove ping timer.');
    }
  });
  return redisClient;
}

exports.randomString = function (length) {
  var letters = 'abcdefghijklmnopqrstuvwxyz';
  var numbers = '1234567890';
  var charset = letters + letters.toUpperCase() + numbers;

  function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  var result = '';
  for (var i = 0; i < length; i++)
  result += randomElement(charset);
  return result;
};
