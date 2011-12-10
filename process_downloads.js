var urlpipe = require('./urlpipe_utils');
var request = require('request');

function run_task(urlkey, url, filename, oauth_token, oauth_token_secret){
	var options = {oauth_token: oauth_token, oauth_token_secret: oauth_token_secret}
    // download the file (and follow redirects?) and pipe to dropbox
    request({url: url}).pipe(urlpipe.dropbox.put_request('/'+filename, options, function(status, reply){
        urlpipe.redis.hset(urlkey, 'status', 'completes', function(err, value){
          setTimeout(check_queue, 1000);
        });
	}));
} 

function fetch_task(){
	// connect to redis
	urlpipe.redis.lpop('task_queue', function(err, urlkey){
    console.log('Found urlkey: '+urlkey);
    urlpipe.redis.hgetall(urlkey, function(error, task){
      console.log('Processing task %s', urlkey);
      console.log(error);
      console.log(task);

      run_task(urlkey, task.url, task.filename, task.oauth_token, task.oauth_token_secret)
    }); 
  });
}

console.log('Starting download processor...');
// TODO: add while loop
function check_queue(){
  urlpipe.redis.llen('task_queue', function(err, length){
    console.log('%d tasks in the queue', length);
    if(length > 0) {
      fetch_task();
    } else {
      // stop this worker by scaling the heroku workers to 0
      urlpipe.set_heroku_workers(0, function(workers){
        console.log("Heroku workers shut down. %d workers running", workers);
        process.exit();
      });
    }        
  });
}

setTimeout(check_queue, 1000);