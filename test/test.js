
var util = require('util');
var debug = require('debug')('qufox');
var cluster = require('cluster');
var QufoxServer = require('../qufox-server');
var QufoxClient = require('../client/qufox-client');

debug('Start Test.');


if (cluster.isMaster) {
  for (var i = 0; i < 1; i++) {
    cluster.fork();
  }

  cluster.on('online', function (worker){
    debug('worker ' + worker.id + ' online  [pid:'+worker.process.pid+']');
  });

  cluster.on('listening', function (worker, address){
    debug('worker ' + worker.id + ' listening '+address.address+':'+address.port+' [pid:'+worker.process.pid+']');
  });
}
else {
  var server = new QufoxServer({
    listenTarget: 14000,
    redisUrl: 'redis://localhost',
    // redisSentinel: config.redisSentinel,
    instanceName: 'test',
  });
}

debug(new QufoxClient());
//
// for (var index = 0; index < 1000; ++index){
//
// // console.log(util.inspect(server.io._adapter, { depth: 1 }));
//   // debug(util.inspect);
// }
