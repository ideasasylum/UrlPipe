UrlPipe
=======

A really simple node.js app which uses your Dropbox account to store the results of a URL. It uses the Dropbox OAuth api, downloads a file from a URL that you specify, and then uploads this to your Dropbox account under /apps/UrlPipe/

It now has a Redis backend and a simple worker process which actually does the file transfer to avoid locking up the web dyno. To keep costs low, the worker process is only started on demand and shuts down after all the download tasks have finished.

Try it now at [urlpipe.com](http://urlpipe.com)

To Install
----------

	git clone git@github.com:hopeless/UrlPipe.git
	npm install

To Start
--------

	node urlpipe.js <dropbox app key> <dropbox app secret>

You can find [the dropbox infomation here](https://www.dropbox.com/developers/apps)

	export APP_KEY=<your app key>
	export APP_SECRET=<your app secret>
	node urlpipe.js

Deployment to Heroku
--------------------

	heroku create --stack cedar
	heroku config:add APP_KEY=$APP_KEY
	heroku config:add APP_SECRET=$APP_SECRET
	heroku config:add HEROKU_KEY=<your heroku api key>
	heroku config:add SESSION_SECRET=<whatever>
	heroku addons:add redistogo
	git push heroku master
	heroku ps:scale web=1
	