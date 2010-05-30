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
var mongo = require('mongodb');
var backend = require('./backend');
  
configure(function(){
  use(MethodOverride);
  use(ContentLength);
  use(Logger);
  set('root', __dirname);
})

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
  this.render(file + '.css.sass', { layout: false });
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
        populate( doc.url );
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

run();
