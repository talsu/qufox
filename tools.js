var redis = require("redis");
var util = require('util');
var debug = require('debug')('qufox');

exports.createRedisClient = function (redisUrl, option) {
    debug('CreateRedisClient - ' + redisUrl);
    if (redisUrl) {
        var rtg = require("url").parse(redisUrl);
        var redisClient = redis.createClient(rtg.port || 6379, rtg.hostname, option);
        if (rtg.auth) {
            var authString = rtg.auth;
            if (authString.indexOf(':') !== -1) {
                authString = authString.split(":")[1];
            }
            
            redisClient.auth(authString);
        }
        
        return redisClient;
    }
    else {
        return redis.createClient("127.0.0.1", 6379, option);
    }
};

exports.createRedisSentinelClient = function (sentinelConfig, option) {
    debug('CreateRedisSentinelClient - ' + util.inspect(sentinelConfig, false, null, true));
    if (sentinelConfig && sentinelConfig.endpoints && sentinelConfig.masterName) {
        return require('redis-sentinel').createClient(sentinelConfig.endpoints, sentinelConfig.masterName, option);
    }
};

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
}
