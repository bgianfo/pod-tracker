#!/usr/bin/env node

/**
 * @author Brian Gianforcaro (b.gianfo@gmail.com)
 */

require.paths.push('./deps/mongo/lib');
require.paths.push('./deps/underscore');

var kiwi = require('kiwi');
kiwi.require('express');
require('express/plugins')
require('underscore');
var sys = require('sys');
var http = require('http');
var mongo = require('mongodb');
var backend = require('./backend');
  
configure(function(){
  use(MethodOverride);
  use(ContentLength);
  use(Logger);
  set('root', __dirname);
})

//configure('production');

//getRoot
get('/', function(){
  var self = this;
  var server = new mongo.Server(MONGO_HOST,MONGO_PORT, {});
  var db = new mongo.Db( "pod-tracker", server , {});
  db.open(function(err, db) {
    db.collection('feeds', function(err, collection) {
      collection.find(function(err, cursor) {
        cursor.fetchAllRecords( function(err, items) {
          if ( items != null ) {
            sys.puts(sys.inspect(items));
            self.render('index.html.haml', {
              locals: {
                sytlesheets: "style.css",
                title: 'Podcasts',
                articles: items
              }
            });
          }
          db.close();
        });
        
      });
    });
  });
})

/**
 * Simple route for all css/sass files.
 *
 * @param file The css file the browswer has requested
 */
get('/*.css', function(file){
   if ( file == "uniform" ) {
     this.render('uniform.css', { layout: false });
   } else {
     this.render(file + '.css.sass', { layout: false });
   }
});

//addNewBlog

/**
 * Render the add a new podcast page
 */
get('/new', function(){
  this.render('new.html.haml', {
    locals: {
      title: 'New Post'
    }
  });
});

//postNewBlog

/**
 * Process a post to the add a new podcast page.
 * Then redirect back to "/".
 */
post('/new', function(){
  var self = this;
  doc = new Object();
  doc.title = this.param('title');  
  doc.url = this.param('url');
  var server = new mongo.Server(MONGO_HOST,MONGO_PORT, {});
  var db = new mongo.Db( "pod-tracker", server , {});
  db.open( function( err, db ) {
    db.collection( "feeds", function( err, collection ) {
      collection.insert( doc, function(e,d) { 
        db.close();
        self.redirect('/')
        sys.puts( "populating " + doc.url + " with id: " + doc._id ); 
        populate( doc.url, doc._id );
      });
    });
  });
}); 

get('/id/*', function( id ){
  var self = this;
  var server = new mongo.Server(MONGO_HOST,MONGO_PORT, {});
  var db = new mongo.Db( "pod-tracker", server , {});
  db.open(function(err, db) {
    db.collection('feeds', function(err, collection) {
      collection.find({"_id": id}, function(err, cursor) {
        cursor.fetchAllRecords( function(err, items) {
          if ( items != null ) {
            sys.puts(sys.inspect(items));
            self.render('list.html.haml', {
              locals: {
                title: 'Podcasts',
                articles: items
              }
            });
          }
          db.close();
        });
        
      });
    });
  });
  /*
  this.render('blog_new.html.haml', {
    locals: {
      title: 'New Post'
    }
  });
  */
});

/*
 * Disabling for now
 *
get('/proxy/*', function( url ){
  sys.puts("Proxy call for URL: " + url );
  sys.puts( backend.getUrlTarget( url ) );
  sys.puts( backend.getUrlRoot( url ) );
  sys.puts( backend.getUrlRoot( url, true ) );
  
  var done = false;
  var c = http.createClient( HTTP_PORT, getUrlRoot( url, true ) );
  var r = c.request( 'GET', 
                     backend.getUrlTarget( url ), 
                     { 'host': backend.getUrlRoot( url, false ) }
  );

  r.addListener( 'response', function (response) {
    total = "";
    r.setEncoding('utf8');
    r.addListener( 'data', function (chunk) {
      total += chunk;
    });

    r.addListener( 'end', function (chunk) {
      done = true;
    });
  });
  r.end();
  while ( true ) {
    sys.puts( "waiting" );
    if ( done ) {
      return total;
    }
  }
});
*/
run();
