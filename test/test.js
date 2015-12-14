
var util = require('util');
var debug = require('debug')('qufox-test');
var cluster = require('cluster');
var async = require('async');
var assert  = require('assert');
var QufoxServer = require('../qufox-server');
var config = require('./test-config');

var portBase = 14000;

var clientOptions = {
  'path': '/qufox.io',
  'sync disconnect on unload': true,
  'reconnection limit': 6000, //defaults Infinity
  'max reconnection attempts': Infinity, // defaults to 10
  'force new connection': true
};

function ServerStartAndStopTest(callback){
  var server = new QufoxServer({
    listenTarget: portBase,
    redisUrl: 'redis://localhost',
    // redisSentinel: config.redisSentinel,
    instanceName: 'test',
  });

  server.on('listening', function(){
    var client = require('qufox-client')('http://localhost:' + (portBase), clientOptions);
    client.onStatusChanged(function(status){
      debug(status);
      if (status == 'connected') {
        server.close();
      }
      if (status == 'disconnect'){
        client.close();
        console.log('ServerStartAndStopTest - Success');
        callback();
      }
    });
  });

  server.on('close', function(){
  });
}

function RedisAdaptorTest(callback){
  var indexs = [];
  for (var i = 0; i < config.RedisAdaptorTest.numberOfInstance; ++i){
    indexs.push(i);
  }

  var servers = null;
  var sessionName = 'session-sendTest';

  STEP0_createServers();

  function STEP0_createServers(){
    debug('STEP0_createServers');
    async.mapSeries(indexs, function (index, callback){
      var server = new QufoxServer({
        listenTarget: portBase + index,
        redisUrl: config.RedisAdaptorTest.redisUrl,
        // redisSentinel: config.redisSentinel,
        instanceName: 'test' + index,
      });

      server.on('listening', function (){
        debug('Server ' + index + ' is listening.');
        callback(null, server);
      });
    }, function (err, results){
      if (err) {
        debug(err);
        return;
      }
      servers = results;
      debug(indexs.length + ' servers are listening.');
      STEP1_createClients();
    });
  }

  function STEP1_createClients(){
    debug('STEP1_createClients');
    async.map(indexs, function (index, callback){
      var client = require('qufox-client')('http://localhost:' + (portBase + index), clientOptions);
      var isCallbackCalled = false;
      client.onStatusChanged(function(status){
        if ('connected') {
          if (!isCallbackCalled) {
            isCallbackCalled = true;
            callback(null, client);
          }
        }
      });
    }, function (err, clients){
      if (err) {
        debug(err);
        return;
      }
      debug(clients.length + ' clients are connected.');
      STEP2_join(clients);
    });
  }

  function STEP2_join(clients){
    debug('STEP2_join');
    var receiveCount = 0;
    async.each(clients, function (client, callback){
      client.join(sessionName, function receiveCallback(packet){
        debug('packet received');
        if (packet == 'sendTest'){
          ++receiveCount;
        }

        if (receiveCount == clients.length - 1){
          STEP3_leave(clients);
        }
      }, callback);
    }, function(){
      debug('join complete');
      clients[0].send(sessionName, 'sendTest');
    });
  }

  function STEP3_leave(clients){
    debug('STEP3_leave');
    async.each(clients, function (client, callback){
      client.leave(sessionName, null, callback);
    }, function(){
      debug('leave complete');
      STEP4_close(clients);
    });
  }

  function STEP4_close(clients){
    debug('STEP4_close');
    clients.forEach(function (client){ client.close(); });
    async.each(servers, function (server, callback){
      server.once('close', function () {callback();});
      server.close();
    }, function(){
      console.log('RedisAdaptorTest - Success');
      callback();
    });
  }
}

var tests = [ ServerStartAndStopTest ];

if (config.RedisAdaptorTest) tests.push(RedisAdaptorTest);

async.waterfall(tests, function (err){
  if (err) {
    console.log('Test fail - ' + util.inspect(err, false, null, true));
  }
  else{
    console.log('All test complete.');
  }

  process.exit(0);
});
