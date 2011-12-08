UrlPipe
=======

A really simple node.js app which uses your Dropbox account to store the results of a URL. It uses the Dropbox OAuth api, downloads a file from a URL that you specify, and then uploads this to your Dropbox account under /apps/UrlPipe/

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
	git push heroku master
	heroku ps:scale web=1
	