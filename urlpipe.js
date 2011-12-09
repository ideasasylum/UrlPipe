urlpipe = require('./urlpipe_utils');

var server = 'localhost:3000';
if(process.env.NODE_ENV == 'production'){
  server = 'urlpipe.heroku.com'
}

///////////////////////////////////////
var request = require('request');
var express = require('express');
var app = express.createServer();
var url = require('url');


urlpipe.redis.on("error", function (err) {
    console.log("Error " + err);
});


// Create and configure an Express server.
app.configure(function () {
  app.use(express.static(__dirname + '/public'))
  , app.use(express.logger())
  , app.use(express.bodyParser())
  , app.use(express.cookieParser())
  , app.use(express.session({ secret: 'gmfdoejrgnr'} ));
});


app.get('/', function(req, res) {
  urlpipe.dropbox.request_token(function(status, reply){
    console.log("Request token callback");
    console.log(status);
    console.log(reply);
    req.session.oauth_token = reply.oauth_token;
    req.session.oauth_token_secret = reply.oauth_token_secret;
    // do authorisation
    res.redirect("https://www.dropbox.com/1/oauth/authorize?oauth_token="+reply.oauth_token+"&oauth_callback=http://"+server+"/oauth_callback");
  });
});

app.get('/oauth_callback', function(req, res) {
  console.log("OAuth callback");
  options = urlpipe.get_auth_token(req, res);
  console.log(options);
  urlpipe.dropbox.access_token(options, function(status, reply){
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
  options = urlpipe.get_access_token(req, res);

  var error_message, info_message;
  if(req.session.info_message){
    info_message = req.session.info_message;
    req.session.info_message = undefined;
  }

  if(options){
    urlpipe.dropbox.account(options, function(status, reply){
      if(status != 200){
        error_message = "Error connecting to Dropbox:"+status;
      }
      var dropbox_name = reply.display_name;

      urlpipe.redis.llen('task_queue', function(err, length){
        res.render('upload_form.ejs', {
          locals: {
            name: dropbox_name,
            tasks: length,
            error: error_message,
            info: info_message
          }
        });        
      });

    });
  }
});

app.post('/upload', function(req, res){
  options = urlpipe.get_access_token(req, res);

  console.log(req);
  if(options){
    var path = url.parse(req.body.url).pathname;
    var elements = path.split('/');
    var filename = elements[elements.length-1];

    // Get a unique key for this download task
    urlpipe.redis.incr('task_id', function(err, urlkey){
      // Add the task to Redis
      urlpipe.redis.hmset(urlkey, [
        "url", req.body.url, 
        "filename", filename, 
        "oauth_token", options.oauth_token, 
        "oauth_token_secret", options.oauth_token_secret], function(err, status){
          console.log('Added task to redis');
          // Add this task to the Redis queue
          urlpipe.redis.rpush("task_queue", urlkey, function(err, num_tasks){
            console.log("There's now "+ num_tasks + " queued task");
            // ensure there's a Heroku worker running to handle this task
            urlpipe.set_heroku_workers(1, function(workers){
              console.log(workers);
              console.log("There's "+workers+" heroku workers running"); 
            });
          });
      });
    });

    res.redirect('/upload');
  }
});

app.get('/heroku_test', function(req, res){
  urlpipe.set_heroku_workers(1, function(num_workers){
    console.log(num_workers);
  });
});


var port = process.env.PORT;
if(port == undefined){
  port = 3000;
}
app.listen(port);
console.log('UrlPipe running on port ' + app.address().port);
