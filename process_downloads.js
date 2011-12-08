// Read dropbox key and secret, and heroku app key from the command line.
var app_key = process.argv[2],
    app_secret = process.argv[3],
    heroku_key = process.argv[4];

if(app_key == undefined || app_secret == undefined){
  app_key = process.env.APP_KEY;
  app_secret = process.env.APP_SECRET;
  heroku_key = process.env.HEROKU_KEY;
}

if (app_key == undefined || app_secret == undefined) {
  console.log("Usage: node urlpipe.js <dropbox key> <dropbox secret> <heroku_key>\n Or use the APP_KEY, APP_SECRET and HEROKU_KEY env variables");
  process.exit(1);
}

// Create the Redis connection
if(process.env.REDISTOGO_URL == undefined){
  var redis = require('redis').createClient();
} else {
  var rtg   = require("url").parse(process.env.REDISTOGO_URL);
  var redis = require("redis").createClient(rtg.port, rtg.hostname);
  redis.auth(rtg.auth.split(":")[1]);
}

var dbox = require('dbox');
var request = require('request');

// Dropbox client
var dropbox = dbox.createClient({
  app_key    : app_key,             // required
  app_secret : app_secret,          // required
  root       : "sandbox"            // optional (defaults to sandbox)
});

function run_task(url, filename, oauth_token, oauth_token_secret){
	var options = {oauth_token: oauth_token, oauth_token_secret: oauth_token_secret}
    // download the file (and follow redirects?) and pipe to dropbox
    request({url: url}).pipe(dropbox.put_request('/'+filename, options, function(status, reply){
        console.log(status);
        console.log(reply);
        res.redirect('/upload');
	}));
} 


function fetch_task(){
	// connect to redis
	var urlkey = redis.lpop('task_queue');
	redis.hgetall(urlkey, function(error, task){
		
	});	
}


// fetch the tasks, run them
run_task(fetch_task);

// stop this worker