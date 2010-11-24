
currentSong = new Object()

currentPos = 0;

function play( url, id ) {
  abstractPlay( url, id, 0 );
}

function resume( url, id ) {
  started = false;
  $.ajax( {
     url: "/getpos/" + id ,
     success: function( res ) {
        pos = 1*res
        currentSong = soundManager.createSound({
          id: id,
          url: url,
          autoLoad:true,
          position: pos,
          onplay : function() {
              //$("#prog").progressbar('option','value', 0);
              $("#"+id).addClass('playing')
          },

          whileplaying: function() {
            if ( this.position - currentPos > 10000 ) {
              currentPos = this.position;

              $.ajax({
                url: "/setpos/" + id + "/" + this.position,
                success: function() {
                }});
            }
            $("#prog").progressbar( 'option','value', (this.position/this.durationEstimate)*100 );
          },
          whileloading: function() {
            if ( !started ) {
              if ( this.duration > (pos+500)  ) {
                started = true
                currentSong.play( id, {position:pos} );
                currentSong.setPosition( pos )
                console.log("Loaded: " + this.duration )
              } 
            }
          },
          onfinish: function() {
            $("#"+id).removeClass('playing')
            currentPos = 0;
            $("#prog").progressbar( 'option','value', 0 );
          }
        });
     }
  });
}

function togglePause() {
  currentSong.togglePause();
}

function abstractPlay( url, id, pos ) {

  currentSong = soundManager.createSound({
    id: id,
    url: url,
    onplay : function() {
      //$("#prog").progressbar( 'option','value', 0 );
      $("#"+id).addClass('playing')
    },
    whileplaying: function() {
      if ( this.position - currentPos > 2000 ) {
        currentPos = this.position;

        $("#prog").progressbar( 'option','value', (this.position/this.duration)*100 );
        $.ajax({
          url: "/setpos/" + id + "/" + this.position,
          success: function() {
          }});
      }
    },
    onfinish: function() {
      currentPos = 0;
    }
  });

  currentSong.setPosition( pos );
  currentSong.play();
}


function remove( id ) {

  $.ajax({
    url: "/rmepisode/" + id,
    context: document.body,
    success: function() {
      $("#"+id).remove()
    }});

  if ( id === currentSong.sID ) {
    currentSong.stop()
  }
}

