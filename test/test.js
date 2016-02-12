
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

describe('QufoxServer Test', function () {
  var server = null;

  before(function (done){
    server = new QufoxServer({
      listenTarget: portBase,
      instanceName: 'test',
    });
    server.on('listening', done);
  });

  it('Server start', function (done) {
    var client = require('qufox-client')('http://localhost:' + (portBase), clientOptions);
    client.onStatusChanged(function(status){
      if (status == 'connected') {
        client.close();
        done();
      }
    });
  });

  it('Echo message', function (done){
    this.timeout(5000);
    var sessionName = 'echoSession';
    var testMessage = 'this is a test.';
    var client = require('qufox-client')('http://localhost:' + (portBase), clientOptions);
    client.join(sessionName, function (message){
      assert.equal(message, testMessage);
      client.close();
      done();
    }, function (){
      client.send(sessionName, testMessage, true);
    });
  });

  it('Send message', function (done){
    this.timeout(5000);
    var sessionName = 'SendMessageSession';
    var testMessage = 'this is a test.';
    var readyCount = 0;
    var receiver = require('qufox-client')('http://localhost:' + (portBase), clientOptions);

    receiver.join(sessionName, function (message) {
      assert.equal(message, testMessage);
      receiver.close();
      done();
    }, function (){
      var sender = require('qufox-client')('http://localhost:' + (portBase), clientOptions);
      sender.onStatusChanged(function(status){ if (status == 'connected') {
        sender.send(sessionName, testMessage);
        sender.close();
      }});
    });
  });

  it('Multiple client communication', function (done){
    this.timeout(10000);
    var clients = [];
    for (var i = 0; i < 10; ++i){
      clients.push(
        require('qufox-client')('http://localhost:' + (portBase), clientOptions)
      );
    }
    clientsCommunicationTest(clients, function(){
      for (var i = 0; i < 10; ++i){
        clients[i].close();
      }
      done();
    });
  });

  it('Server stop', function (done){
    this.timeout(10000);
    var client = require('qufox-client')('http://localhost:' + (portBase), clientOptions);
    client.onStatusChanged(function(status){
      if (status == 'connected') {
        server.close();
      }
      if (status == 'disconnect') {
        client.close();
        done();
      }
    });
  });

  after(function (){
    server.close();
  });
});

if (config.RedisAdaptorTest && config.RedisAdaptorTest.numberOfInstance){
  describe('Redis adapter test.', function () {
    var indexs = [];
    for (var i = 0; i < config.RedisAdaptorTest.numberOfInstance; ++i){
      indexs.push(i);
    }

    var servers = null;
    var clients = null;

    it('Create ' + config.RedisAdaptorTest.numberOfInstance + ' servers', function (done){
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
        done();
      });
    });

    it('Create clients', function (done){
      async.map(indexs, function (index, callback){
        var client = require('qufox-client')('http://localhost:' + (portBase + index), clientOptions);
        client.onStatusChanged(function(status){
          if (status == 'connected') {
            callback(null, client);
          }
        });
      }, function (err, result){
        if (err) {
          throw err;
        }
        clients = result;
        debug(clients.length + ' clients are connected.');
        done();
      });
    });

    it('Multiple communication', function (done){
      this.timeout(10000);
      clientsCommunicationTest(clients, function (){
        done();
      });
    });

    it('Close servers.', function (done){
      clients.forEach(function (client){ client.close(); });
      async.each(servers, function (server, callback){
        server.once('close', function () {callback();});
        server.close();
      }, function(){
        done();
      });
    });
  });
}


function clientsCommunicationTest(clients, callback){
  var sessionName = 'testSession';
  var resultsArray = [];
  for (var i = 0; i < clients.length; ++i){
    clients[i].index = i;
    resultsArray[i] = new Array(clients.length);
    for (var j = 0; j < clients.length; ++j) {
      resultsArray[i][j] = false;
    }
    resultsArray[i][i] = true;
  }

  checkResults(false);
  var intervalJob = setInterval(function(){checkResults(false);}, 1000);

  async.each(clients, function (client, next){
    client.join(sessionName, function(clientIndex){
      resultsArray[client.index][clientIndex] = true;
      if (checkResults()){
        checkResults(false);
        clearInterval(intervalJob);
        debug('Communicate all success.');
        callback();
      }
    }, next);
  }, function (err){
    debug('all joined.');
    clients.forEach(function (client){
      setTimeout(function(){
        client.send(sessionName, client.index);
      }, 500 * client.index);
    });
  });

  function checkResults(isPrint){
    if (isPrint) console.log('---- result array ----');
    resultsArray.forEach(function(results){
      var printArray = results.map(function(result){ return result ? 1 : 0; });
      if (isPrint) console.log(printArray);
    });

    var allDone = resultsArray.every(function (results){
      return results.every(function (result){ return result; });
    });

    if (isPrint) console.log(allDone);

    return allDone;
  }
}
