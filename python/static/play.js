
currentSong = new Object()

currentPos = 0;

/**
 * Handler for player play action.
 */
playHandle = function() {
  $("#prog").progressbar('enable');
  $("#prog-button").attr('src','/static/pause.png');
  //$("#"+currentSong.sID).addClass('playing');
}

/**
 * Handler for player pause action.
 */
pauseHandle = function() {
  $("#prog").progressbar('disable');
  $("#prog-button").attr('src','/static/play.png')
}

resumeHandle = function() {
  $("#prog").progressbar('enable');
  $("#prog-button").attr('src','/static/pause.png');
}

/**
 * Handler for streaming playing events.
 */
playingHandle = function() {
  if ( currentSong.position - currentPos > 1000 ) {
    currentPos = currentSong.position;
    $.ajax({ url: "/setpos/" + currentSong.sID + "/" + this.position });
  }
  percent = (currentSong.position/currentSong.durationEstimate)*100;
  $("#prog").progressbar( 'option','value', percent );
}

finishHandle = function() {
  currentPos = 0;
  //$("#"+currentSong.sID).removeClass('playing');
  $("#prog").progressbar('option','value', 0);
  $("#prog").progressbar('disable');
  $("#curr-song").text('');
}

/**
 * Main dispatch to start the playing of a song from a previous location.
 */
function resume( url, id, title ) {
  $("#curr-song").text( title );

  $('.ep-title').filter(function(){
      return $(this).parent().attr('id') != id;
  }).addClass('not-playing');

  started = false;
  $.ajax({
     url: "/getpos/" + id ,
     success: function( res ) {
       pos = 1*res;
       currentSong = soundManager.createSound({
         id: id, url: url, autoLoad:true,
         position:pos, onplay:playHandle, onfinish:finishHandle,
         onpause:pauseHandle, whileplaying:playingHandle, onresume:resumeHandle,
         whileloading: function() {
           if ( !started ) {
             if ( this.duration > (pos+1000)  ) {
               started = true;
               currentSong.setPosition( pos );
               currentSong.play( id, {position:pos} );
             } 
           }
         }
       });
     }
  });
}

function togglePause() {
  currentSong.togglePause();
}

function play( url, id, title ) {
  $("#curr-song").text( title );

  $('.ep-title').addClass('not-playing');

  currentSong = soundManager.createSound({
    id:id, url:url, onplay:playHandle,
    onpause:pauseHandle, whileplaying:playingHandle,
    onfinish:finishHandle 
  });
  currentSong.play();
}


function remove( id ) {

  $.ajax({ url: "/rmepisode/" + id,
    success: function() {
      $("#"+id).remove();
    }});

  if ( id === currentSong.sID ) {
    currentSong.stop();
    currentSong.unload();
  }
}

