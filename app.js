// This is the entry point for your add-on, creating and configuring
// your add-on HTTP server

// [Express](http://expressjs.com/) is your friend -- it's the underlying
// web framework that `atlassian-connect-express` uses
var express = require('express');
// You need to load `atlassian-connect-express` to use her godly powers
var ac = require('atlassian-connect-express');
process.env.PWD = process.env.PWD || process.cwd(); // Fix expiry on Windows :(
// Static expiry middleware to help serve static resources efficiently
var expiry = require('static-expiry');
// We use [Handlebars](http://handlebarsjs.com/) as our view engine
// via [express-hbs](https://npmjs.org/package/express-hbs)
var hbs = require('express-hbs');
// We also need a few stock Node modules
var http = require('http');
var path = require('path');
var os = require('os');

// Let's use Redis to store our data
try {
  ac.store.register('redis', require('atlassian-connect-express-redis'));
} catch (e) {
  console.warn("WARNING: The optional dependency 'atlassian-connect-express-redis' was not installed. You must configure an alternative store in 'config.js'.\n")
}

// Anything in ./public is served up as static content
var staticDir = path.join(__dirname, 'public');
// Anything in ./views are HBS templates
var viewsDir = __dirname + '/views';
// Your routes live here; this is the C in MVC
var routes = require('./routes');
// Bootstrap Express
var app = express();
// Bootstrap the `atlassian-connect-express` library
var addon = ac(app);
// You can set this in `config.js`
var port = addon.config.port();
// Declares the environment to use in `config.js`
var devEnv = app.get('env') == 'development';

// Load the HipChat AC compat layer
var hipchat = require('atlassian-connect-express-hipchat')(addon, app);

// The following settings applies to all environments
app.set('port', port);

// Configure the Handlebars view engine
app.engine('hbs', hbs.express3({partialsDir: viewsDir}));
app.set('view engine', 'hbs');
app.set('views', viewsDir);

// Declare any Express [middleware](http://expressjs.com/api.html#middleware) you'd like to use here
app.use(express.favicon());
// Log requests, using an appropriate formatter by env
app.use(express.logger(devEnv ? 'dev' : 'default'));
// Include stock request parsers
app.use(express.urlencoded());
app.use(express.json());
app.use(express.cookieParser());
// Gzip responses when appropriate
app.use(express.compress());
// Enable the ACE global middleware (populates res.locals with add-on related stuff)
app.use(addon.middleware());
// Enable static resource fingerprinting for far future expires caching in production
app.use(expiry(app, {dir: staticDir, debug: devEnv}));
// Add an hbs helper to fingerprint static resource urls
hbs.registerHelper('furl', function(url){ return app.locals.furl(url); });
// Mount the add-on's routes
app.use(app.router);
// Mount the static resource dir
app.use(express.static(staticDir));

// Show nicer errors when in dev mode
if (devEnv) app.use(express.errorHandler());

// Wire up your routes using the express and `atlassian-connect-express` objects
routes(app, addon);

// Boot the damn thing
http.createServer(app).listen(port, function(){
  console.log()
  console.log('Add-on server running at '+ (addon.config.localBaseUrl()||('http://' + (os.hostname()) + ':' + port)));
  // Enables auto registration/de-registration of add-ons into a host in dev mode
  if (devEnv) addon.register();
});
