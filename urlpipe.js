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

///////////////////////////////////////
var dbox = require('dbox');
var request = require('request');
var express = require('express');
var app = express.createServer();
var fs = require('fs');
var url = require('url');

// Create the Redis connection
if(process.env.REDISTOGO_URL == undefined){
  var redis = require('redis').createClient();
} else {
  var rtg   = require("url").parse(process.env.REDISTOGO_URL);
  var redis = require("redis").createClient(rtg.port, rtg.hostname);
  redis.auth(rtg.auth.split(":")[1]);
}

redis.on("error", function (err) {
    console.log("Error " + err);
});


// Create and configure an Express server.
app.configure(function () {
  app.use(express.static(__dirname + '/public'))
  , app.use(express.logger())
  , app.use(express.bodyParser())
  , app.use(express.cookieParser())
  , app.use(express.session({ secret: '1ts-s3cr3t!'} ));
});

// Dropbox client
var dropbox = dbox.createClient({
  app_key    : app_key,             // required
  app_secret : app_secret,          // required
  root       : "sandbox"            // optional (defaults to sandbox)
});


app.get('/', function(req, res) {
  dropbox.request_token(function(status, reply){
    console.log("Request token callback");
    console.log(status);
    console.log(reply);
    req.session.oauth_token = reply.oauth_token;
    req.session.oauth_token_secret = reply.oauth_token_secret;
    // do authorisation
    res.redirect("https://www.dropbox.com/1/oauth/authorize?oauth_token="+reply.oauth_token+"&oauth_callback=http://urlpipe.heroku.com/oauth_callback");
  });
});

app.get('/oauth_callback', function(req, res) {
  console.log("OAuth callback");
  options = get_auth_token(req, res);
  console.log(options);
  dropbox.access_token(options, function(status, reply){
    console.log("Access token callback");
    console.log(status);
    console.log(reply);
    req.session.access_token = reply.oauth_token;
    req.session.access_token_secret = reply.oauth_token_secret;
    res.redirect('/upload');
  });
});

app.get('/upload', function(req, res){
  console.log("Upload form");
  options = get_access_token(req, res);
  console.log(options);
  if(options){
    dropbox.account(options, function(status, reply){
      console.log("Account callback");
      console.log(status);
      console.log(reply);
      res.render('upload_form.ejs', {
        locals: {
          name: reply.display_name
        }
      });
    });
  }
});

app.post('/upload', function(req, res){
  options = get_access_token(req, res);

  console.log(req);
  if(options){
    var path = url.parse(req.body.url).pathname;
    var elements = path.split('/');
    var filename = elements[elements.length-1];

    // Get a unique key for this download task
    var urlkey = redis.incr('task_id');

    // Add the task to Redis
    redis.hset(urlkey, [
      "url", req.body.url, 
      "filename", filename, 
      "oauth_token", options.oauth_token, 
      "oauth_token_secret", options.oauth_token_secret]);

    // Add this task to the Redis queue
    redis.rpush("task_queue", urlkey);

    // ensure there's a Heroku worker running to handle this task
    set_heroku_workers(1, function(workers){ console.log(workers); });
  }
});

app.get('/heroku_test', function(req, res){
  set_heroku_workers(1, function(num_workers){
    console.log(num_workers);
  });
});

function get_heroku_workers(callback){
  request.get({ json:'true', 
                url: 'https://:'+heroku_key+'@api.heroku.com/apps/urlpipe/ps'},
                function(status, reply){
                  console.log(reply.body);
                  callback(reply.body.length);
  });
}

function set_heroku_workers(num_workers, callback){
  request.post({ json:'true', 
                url: 'https://:'+heroku_key+'@api.heroku.com/apps/urlpipe/ps/scale?type=worker&qty=1'
              },
              function(status, reply){
                console.log(reply.body);
                callback(reply.body);
              });  
}


function get_auth_token(req, res){
  options = {oauth_token: req.session.oauth_token,
             oauth_token_secret: req.session.oauth_token_secret};
  if(options.oauth_token && options.oauth_token_secret){
    return options;
  } else {
    res.redirect('/');
    return null;
  }
}

function get_access_token(req, res){
  options = {oauth_token: req.session.access_token,
             oauth_token_secret: req.session.access_token_secret};
  if(options.oauth_token && options.oauth_token_secret){
    return options;
  } else {
    res.redirect('/');
    return null;
  }
}

var port = process.env.PORT;
if(port == undefined){
  port = 3000;
}
app.listen(port);
console.log('UrlPipe running on port ' + app.address().port);
