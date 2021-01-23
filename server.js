const fs = require('fs');
const express = require('express');
const https = require('https');
const path = require('path');
const expressStaticGzip = require('express-static-gzip');
con = {
	log:console.log,
	logRouteC:console.log
}
const packageJSON = require('./package.json');
process.env.ENV = packageJSON.env.env;
let swFile = process.env.ENV === 'PRODUCTION' ? fs.readFileSync('../client/sw.js') : fs.readFileSync('../pairly-chat-pwa/public/sw.js');
process.env.SERVICE_WORKER_VERSION = swFile.toString().match(new RegExp('/\\*SW-VERSION\*([^]+?)SW-VERSION\\*/','g'))[0].replace(new RegExp('/\\*SW-VERSION\\*/','g'),'').replace(/'/g,'');
//process.env.ENV = 'PRODUCTION';
process.env.ENV_PATH = packageJSON.env.envPath;
const helper = require(process.env.ENV_PATH);
process.env = helper.getEnv();
app = express();
const bodyParser = require("body-parser");
const serverHelper = require('./lib/Helper');
app.use(bodyParser.json());
app.users = {};

//if (process.env.ENV === 'DEVELOPMENT') process.env.PORT = 443;
app.set('port', process.env.PORT || 8081);
let certPath =  process.env.ENV === 'PRODUCTION' ? '/home/ubuntu/.acme.sh/chat.pairly.app' : 'cert';
const httpsOptions = {
	key: fs.readFileSync(path.join(certPath, process.env.DOMAIN+'.key')),
	cert: fs.readFileSync(path.join(certPath, process.env.DOMAIN+'.cer'))
};
con.log('-----------------------------------------------','green');
con.log('| ENV           ',process.env.ENV,'green');
con.log('| VERSION       ',packageJSON.version,'green');
con.log('| PORT          ',app.get('port'),'green');
con.log('| SW_VERSION    ',process.env.SERVICE_WORKER_VERSION);
con.log('| DOMAIN        ',process.env.DOMAIN);
con.log('-----------------------------------------------','green');
const server = https.createServer(httpsOptions, app).listen(app.get('port'),'0.0.0.0', function() {
	//con.log('Express HTTPS server listening on port ' + app.get('port'));
});
require('./lib/redirect.js')(process.env.PORT || 8080);

if (process.env.ENV === 'PRODUCTION')
{
	app.use('/assets', express.static(__dirname + "/../client/public/assets"));
	app.use( (req, res, next) => {
		//con.log('REQ LOG',req.method,req.originalUrl);
		if (req.originalUrl === '/')
		{
			con.log('REQ INDEX LOG',req.method,req.originalUrl, new Date().getTime());
		}
		next();
	});
	app.use('/', expressStaticGzip(path.join(__dirname,'/../client/'), {enableBrotli: true,  orderPreference: ['br', 'gzip']}));
}

app.use('/', require('./routes/root.js').router);
app.use('/api/auth', require('./routes/auth.js').router);
app.use('/api/health', require('./routes/health.js').router);
app.use('/api/media', require('./routes/media.js').router);
app.use('/api/dashboard', require('./routes/dashboard.js').router);
app.use( (req, res, next) => {

	//console.log('Verify Req',req.method,req.originalUrl,req.headers);
	let [err,data] = serverHelper.verifyToken(req.headers.token)
	if (!err)
	{
		req.userId = data.userId;
		//res.status(405).send();
		next();
	}
	else
	{
		con.warn('Unverified',err,req.method.toUpperCase(),'Request to ',req.originalUrl,'token',req.headers.token)
		res.status(405).send();
	}
});
app.use('/api/chats', require('./routes/chats.js').router);
app.io = require("socket.io")(server,{
	pingInterval: 25000,
	upgradeTimeout: 25000,
	pingTimeout: 60000,
});
app.io.sockets.on("connection", (socket) => {
	require('./routes/auth.js').socket(socket);
	require('./routes/chats.js').socket(socket);
	require('./routes/users.js').socket(socket);
	require('./routes/dashboard.js').socket(socket);
});

process.on('uncaughtException', function(err) {
	console.log('Caught exception: ' + err);
	throw err;
});

