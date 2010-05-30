require.paths.push('./deps/mongo/lib');
require.paths.push('./deps/node-xml/lib');

var http = require('http');
var xml = require('node-xml');
var mongo = require('mongodb');
 
HTTP_PORT  = 80
MONGO_HOST = "localhost";
MONGO_PORT = mongo.Connection.DEFAULT_PORT;

function populate( string ) {

  getUrlRoot = function( s, addHttp ) {
    HTTP_OFFSET = 7;
    offset = s.indexOf( "/", HTTP_OFFSET );
    if ( addHttp ) {
      return s.substring( 0 , offset )
    } else {
      return s.substring( HTTP_OFFSET, offset );
    }
  }

  getUrlTarget = function( s ) {
    HTTP_OFFSET = 7;
    offset = s.indexOf( "/", HTTP_OFFSET );
    return s.substr( offset );
  }

  var client = http.createClient( HTTP_PORT, getUrlRoot( string, true ) );
  var request = client.request( 'GET', getUrlTarget( string ), {
                                'host': getUrlRoot( string, false ) 
                                });

  request.addListener( 'response', function (response) {
    total = "";
    response.setEncoding('utf8');
    response.addListener( 'data', function (chunk) {
      total += chunk;
    });

    response.addListener( 'end', function (chunk) {
      sys.puts("Connecting to " + MONGO_HOST + ":" + MONGO_PORT );
      var parser = new xml.SaxParser( function( p ) {
        var title = "";
        var length = 0;
        var url = "";
        var cur = "";
        var inItem = false;
        var inChannel = false;
        var done = false;
        p.onStartElementNS( function( elem, attrs, p, u, n ) {
          cur = elem;
          if ( elem == "channel" ) {
            inChannel = true;
          }
          if ( inChannel && elem == "item" ) {
            inItem = true;
          }
          if ( elem == "enclosure" ) {
            for( key in attrs ) {
              if ( attrs[key][0] == "url" ) {
                url = attrs[key][1];
              }

              if ( attrs[key][0] == "length" ) {
                length = attrs[key][1];
              }
            }
          }
        });

        p.onEndElementNS( function( elem, prefix, uri ) {
          if ( !done && inChannel && elem == "item" ) {
            var doc = new Object();;
            doc.url = url;
            doc.title = title;
            doc.length = length; 
            var server = new mongo.Server(MONGO_HOST,MONGO_PORT, {});
            var db = new mongo.Db( "pod-tracker", server , {});
            db.open( function( err, db ) {
              db.collection( string, function( err, collection ) {
                collection.insert( doc, function(e,d){ 
                  db.close();
                });
              });
            });
            inItem = false;
          }
          if ( elem == "channel" ) {
            inChannel = false;
            done = true;
          }
        });

        p.onCharacters( function( chars ) {
          if ( cur == "title" &&  inChannel && inItem && !done ) {
            if (chars != "\n") {
              title = chars;
            }
          }
        });
      });
      parser.parseString( total );
    });
  });
  request.end();
}

exports.populate = populate;
