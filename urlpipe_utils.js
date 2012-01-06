this.get_rtg_credentials = function(){
  credentials = {};
  if(process.env.REDISTOGO_URL != undefined){
    var rtg = require("url").parse(process.env.REDISTOGO_URL);
    var auth = rtg.auth.split(":");
    credentials.host = rtg.hostname;
    credentials.port = rtg.port;
    credentials.db = auth[0];
    credentials.pass = auth[1];  
  }
  return credentials;
}

this.set_heroku_workers = function(num_workers, callback){
  request.post({ json:'true', 
              url: 'https://:'+heroku_key+'@api.heroku.com/apps/urlpipe/ps/scale?type=worker&qty='+num_workers
            },
            function(status, reply){
              callback(reply.body);
            });  
}

this.get_heroku_workers = function(callback){
  request.get({ json:'true', 
                url: 'https://:'+heroku_key+'@api.heroku.com/apps/urlpipe/ps'},
                function(status, reply){
                  console.log(reply.body);
                  callback(reply.body.length);
  });
}

this.get_auth_token = function(req, res){
  options = {oauth_token: req.session.oauth_token,
             oauth_token_secret: req.session.oauth_token_secret};
  if(options.oauth_token && options.oauth_token_secret){
    return options;
  } else {
    res.redirect('/');
    return null;
  }
}

this.get_access_token = function(req, res){
  options = {oauth_token: req.session.access_token,
             oauth_token_secret: req.session.access_token_secret};
  if(options.oauth_token && options.oauth_token_secret){
    return options;
  } else {
    res.redirect('/');
    return null;
  }
}


// Read dropbox key and secret, and heroku app key from the command line.
var app_key = process.argv[2]
var app_secret = process.argv[3]
var heroku_key = process.argv[4]

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
var redis = null;
var redisStore = null;
if(process.env.REDISTOGO_URL == undefined){
  redis = require('redis').createClient();
} else {
  rtg = this.get_rtg_credentials();
  redis = require("redis").createClient(rtg.port, rtg.host);
  redis.auth(rtg.pass);
}

// Dropbox client
var dbox = require('dbox');
var request = require('request');
var dropbox = dbox.createClient({
  app_key    : app_key,             // required
  app_secret : app_secret,          // required
  root       : "sandbox"            // optional (defaults to sandbox)
});


this.app_key = app_key;
this.app_secret = app_secret;
this.heroku_key = heroku_key;
this.dropbox = dropbox;
this.redis = redis;

