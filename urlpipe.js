// Read dropbox key and secret from the command line.
var app_key = process.argv[2]
  , app_secret = process.argv[3];

if(app_key == undefined || app_secret == undefined){
  app_key = process.env.APP_KEY;
  app_secret = process.env.APP_SECRET;
}

if (app_key == undefined || app_secret == undefined) {
  console.log("Usage: node urlpipe.js <dropbox key> <dropbox secret>\n Or use the APP_KEY and APP_SECRET env variables");
  process.exit(1);
}

var dbox = require('dbox');
var request = require('request');
var express = require('express');
var app = express.createServer();
var fs = require('fs');
var url = require('url');

// Create and configure an Express server.
app.configure(function () {
  app.use(express.static(__dirname + '/public'))
  , app.use(express.logger())
  , app.use(express.bodyParser())
  , app.use(express.cookieParser())
  , app.use(express.session({ secret: '1ts-s3cr3t!'} ));
});
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
    // download the file (and follow redirects?) and pipe to dropbox
    request({url: req.body.url}).pipe(dropbox.put_request('/'+filename, options, function(status, reply){
        console.log(status);
        console.log(reply);
        res.redirect('/upload');
      }));
  }
});


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
