var redis = require("ioredis");
var util = require('util');
var debug = require('debug')('qufox');

exports.createRedisAdapter = function (option, callback){
  var pubClient = createRedisClient(option);
  var subClient = createRedisClient(option);
  setRedisClientKeepAlivePing(pubClient);
  setRedisEventLog(pubClient, 'PUB');
  setRedisEventLog(subClient, 'SUB');
  var adapter = require('socket.io-ioredis')({
    pubClient : pubClient,
    subClient : subClient
  });
  var isPubReady = false;
  var isSubReady = false;
  pubClient.once('ready', function (){
    if (isSubReady) callback(adapter);
    else isPubReady = true;
  });
  subClient.once('ready', function (){
    if (isPubReady) callback(adapter);
    else isSubReady = true;
  });
};

exports.createRedisSentinelAdapter = function (option, callback){
  var pubSentinelClient = createRedisSentinelClient(option);
  var subSentinelClient = createRedisSentinelClient(option);
  setRedisClientKeepAlivePing(pubSentinelClient);
  setRedisEventLog(pubSentinelClient, 'PUB');
  setRedisEventLog(subSentinelClient, 'SUB');
  var adapter = require('socket.io-ioredis')({
    pubClient : pubSentinelClient,
    subClient : subSentinelClient
  });
  var isPubReady = false;
  var isSubReady = false;
  pubSentinelClient.once('ready', function (){
    if (isSubReady) callback(adapter);
    else isPubReady = true;
  });
  subSentinelClient.once('ready', function (){
    if (isPubReady) callback(adapter);
    else isSubReady = true;
  });
};

function createRedisClient (redisUrl) {
  debug('CreateRedisClient - ' + redisUrl);
  return new redis(redisUrl);
}

function createRedisSentinelClient  (sentinelConfig) {
  debug('CreateRedisSentinelClient - ' + util.inspect(sentinelConfig, false, null, true));
  return new redis({sentinels:sentinelConfig.endpoints, name:sentinelConfig.masterName});
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
