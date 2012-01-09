var urlpipe = require('./urlpipe_utils');
var request = require('request');
var temp = require('temp');
var fs = require('fs');

function run_task(urlkey, url, filename, oauth_token, oauth_token_secret){
	var options = {oauth_token: oauth_token, oauth_token_secret: oauth_token_secret}
    // Download to a temp file and then upload from there
    temp.open({prefix: 'urlpipe_download_', suffix: '_'+filename}, function(err, temp_file){
    var pipe_to_file = request({url: url}).pipe(fs.WriteStream(temp_file.path));
    pipe_to_file.end = function() {
      var dropbox_upload = urlpipe.dropbox.put_request(filename, options, function(status, reply){
        // Remove the temp file
        fs.unlink(temp_file.path);

        // Mark the task as completed
        var task_status = 'completed';
        if(reply.statusCode != 200) {
          task_status = 'failed';
        }
        var multi = urlpipe.redis.multi();
        multi.hmset(urlkey, {'status': task_status, 'error': reply.statusCode});
        if(task_status = 'completed'){
          // Expire the Redis key in 2hours for successful 
          multi.expire(urlkey, 2*60*60*1000);
        } else {
          // Store failed transfers in a list for analysis
          multi.lpush('failed_tasks', urlkey);
        }

        // Check the queue again in 1 sec
        multi.exec(function(err, value){
          process.nextTick(check_queue);  
        });        
      });

      // Make sure we tell Dropbox how big the file will be
      dropbox_upload.headers['Content-Length'] = fs.statSync(temp_file.path).size;
      fs.ReadStream(temp_file.path).pipe(dropbox_upload);
    }
	});
} 

function fetch_task(){
	// connect to redis
	urlpipe.redis.lpop('task_queue', function(err, urlkey){
    console.log('Found urlkey: '+urlkey);
    urlpipe.redis.hgetall(urlkey, function(error, task){
      if(task){
        console.log('Processing task %s: \n %s', urlkey, task);

        run_task(urlkey, task.url, task.filename, task.oauth_token, task.oauth_token_secret)
      } else {
        console.log('Skipping %s', urlkey);
      }
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

process.nextTick(check_queue);