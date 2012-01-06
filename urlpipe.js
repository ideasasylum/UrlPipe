var urlpipe = require('./urlpipe_utils');

var server = 'localhost:3000';
if(process.env.NODE_ENV == 'production'){
  server = 'urlpipe.com'
}

var session_secret = 'blahblahblah';
if(process.env.SESSION_SECRET){
  session_secret = process.env.SESSION_SECRET;
}

///////////////////////////////////////
var request = require('request');
var express = require('express');
var RedisStore = require('connect-redis')(express);
var app = express.createServer();
var url = require('url');

urlpipe.redis.on("error", function (err) {
    console.log("Error " + err);
});

var rtg = urlpipe.get_rtg_credentials();
console.log(rtg);
// Create and configure an Express server.
app.configure(function () {
  app.use(express.static(__dirname + '/public'))
  , app.use(express.logger())
  , app.use(express.bodyParser())
  , app.use(express.cookieParser())
  , app.use(express.session({ secret: 'gmfdoejrgnr', store: new RedisStore(rtg)}));
});


app.get('/', function(req, res) {
  res.render('home.ejs', {});                  
});

app.get('/start', function(req, res) {
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

        var tasks = [];
        var locals = {name: dropbox_name,
                      error: error_message,
                      info: info_message};
        get_task(req, res, tasks, locals, 0);
    }); // dropbox account
  }
});

function get_task(req, res, tasks, locals, i){
  if(req.session.my_tasks != undefined && i < req.session.my_tasks.length){
    var task_id = req.session.my_tasks[i];
    console.log("Fetching %s", task_id);
    urlpipe.redis.hgetall(task_id, function(err, task){
      console.log(err);
      console.log(task);
      // if the task no longer exists (because old tasks expire), remove it
      if(err != undefined){
        req.session.my_tasks = req.session.my_tasks.splice(i, i);
        req.session.save();
      } else {
        tasks.push(task);
        i = i+1;
      }
      get_task(req, res, tasks, locals, i);
    });  
  } else {
    locals['tasks'] = tasks;
    render(res, locals);
  }
}


function render(res, locals){
  console.log('rendering form');
  console.dir(locals);
  res.render('upload_form.ejs', { locals: locals });                  
}

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
        "status", "queued",
        "oauth_token", options.oauth_token, 
        "oauth_token_secret", options.oauth_token_secret], function(err, status){
          console.log('Added task to redis');
          // Add this task to the Redis queue
          urlpipe.redis.rpush("task_queue", urlkey, function(err, num_tasks){
            console.log("There's now "+ num_tasks + " queued task");

            // Store the task key in the session
            if(req.session.my_tasks == undefined) {
              req.session.my_tasks = [urlkey];
            } else {
              req.session.my_tasks.push(urlkey);
            }
            req.session.info_message = "Upload queued";
            req.session.save();
            console.dir(req.session);

            // ensure there's a Heroku worker running to handle this task
            urlpipe.set_heroku_workers(1, function(workers){
              console.log(workers);
              console.log("There's "+workers+" heroku workers running"); 
              res.redirect('/upload');
            });
          });
      });
    });
  }
});


var port = process.env.PORT;
if(port == undefined){
  port = 3000;
}
app.listen(port);
console.log('UrlPipe running on port ' + app.address().port);
