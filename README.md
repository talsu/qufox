Qufox
========

node.js smiple web messaging server.

service is running at http://qufox.com

## Installation

```bash
$ [sudo] npm install qufox -g
```


## Usage

### Execute server on command line
```
Usage : qufox -p [num] -r [url] -i [num]  -s -w -o

Options:
  -p, --port        listen port
  -r, --redisurl    redis server url (when use multiple nodes)
  -w, --websocket   use websocket protocol
```
#### Set config file (config.json)
```json
{
	"servicePort" : "4000",
	"websocket" : true	
}
```
Unsing multiple nodes. (need redis server)
```json
{
	"servicePort" : "4000",
	"redisUrl" : "redis://localhost:6379",
	"websocket" : true,
	"isDebug" : false
}
```
#### Example
#####Server side
```bash
$ qufox --port 4000
```
Service is running at http://localhost:4000
#####Client side
```html
<script src="./bower_components/socket.io-client/socket.io.js"></script>
<script src="./javascripts/qufox-client.js"></script>
<script>
	var client = Qufox('http://localhost:4000');

	client.join('sessionName', function (message) {
	  alert(message);
	});

	client.send('sessionName', 'hello world');
</script>
```
Alert popup appears on the first page when you open two same pages.

### Module
```javascript
var QufoxServer = require('qufox').QufoxServer;

new QufoxServer(4000);
```
Service is running at http://localhost:4000
