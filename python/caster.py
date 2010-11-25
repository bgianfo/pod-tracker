#!/usr/bin/env python

# -*- coding: utf-8 -*-

"""
    Caster
    ~~~~~~

    A podcast application written with Flask and MongoDB.

    :copyright: (c) 2010 by Brian Gianforcaro.
    :license: BSD, see LICENSE for more details.
"""

from __future__ import with_statement

import time
from datetime import datetime

from pymongo import Connection

from pymongo.objectid import ObjectId

from flask import Flask, request, session
from flask import url_for, redirect, render_template
from flask import abort, g, flash

from multiprocessing import Pool

from contextlib import closing

from hashlib import md5
from werkzeug import check_password_hash, generate_password_hash

import os

import feedparser


pool = Pool(processes=4)

# configuration
DATABASE = 'caster'
PER_PAGE = 30
DEBUG = True
#SECRET_KEY = '\xe5\xa4\xb5\x10\xf0\xb2\xe2\x81\xd90m,U\xcf\x82/\x9d\xc0\x17\x15\xd5\xcf'
SECRET_KEY = 'dev-secret'

# create our little application :)
app = Flask(__name__)
app.config.from_object(__name__)
app.config.from_envvar('CASTER_SETTINGS', silent=True)


def initializeCast( cast ):
    rss = cast['rss']
    hash = cast['hash']
    mongoentries = []
    for entry in rss.entries:
      episode = dict()
      episode["hash"]   = hash
      episode["link"]   = entry['link']
      episode["date"]   = entry['updated']
      episode["title"]  = entry['title']
      episode["status"] = "new"
      app.log.warn(" New documenet: " + episode )

      mongoentries.append( episode )
    
    g.db['episodes'].insert( mongoentries )

  
def connect_db():
    """Returns a new connection to the database."""
    con = Connection()
    return con[app.config['DATABASE']]


def init_db():
    """Creates the database tables."""
    with closing(connect_db()) as db:
        with app.open_resource('schema.sql') as f:
            db.cursor().executescript(f.read())
        db.commit()


def query_db(query, args=(), one=False):
    """Queries the database and returns a list of dictionaries."""
    cur = g.db.find(query, args)
    
    return (rv[0] if rv else None) if one else rv


def get_user_id(username):
    """Convenience method to look up the id for a username."""
    rv = g.db['users'].find_one( { "user" : username } )
    return rv["id"] if rv else None


def format_datetime(timestamp):
    """Format a timestamp for display."""
    return datetime.utcfromtimestamp(timestamp).strftime('%Y-%m-%d @ %H:%M')


def gravatar_url(email, size=80):
    """Return the gravatar image for the given email address."""
    hash = md5(email.strip().lower().encode('utf-8')).hexdigest() 
    return 'http://www.gravatar.com/avatar/%s?d=identicon&s=%d' % (hash, size)

def redir( route ):
    """Helper function to redirect to a route."""
    return redirect(url_for(route))

@app.before_request
def before_request():
    """Make sure we are connected to the database each request and look
    up the current user so that we know he's there.
    """
    g.db = connect_db()
    g.user = None
    if 'user_id' in session:
      userObj = g.db['users'].find_one( { "id" : session['user_id'] } )
      g.user = userObj['user']


@app.after_request
def after_request(response):
    """Closes the database again at the end of the request."""
    return response

@app.route('/opml')
def opml():
    """Remove a single episode from the user's database."""
    if 'user_id' not in session:
        abort(401)
    else:
      now  = datetime.utcnow().ctime()
      xml  = "<?xml version=\"1.0\"?>\n"
      xml += "<opml version=\"1.0\">\n"
      xml += "  <head>\n"
      xml += "    <title>Caster Export</title>\n"
      xml += "    <dateCreated>%s GMT</dateCreated>\n" %  now
      xml += "    <dateModified>%s GMT</dateModified>\n" % now
      xml += "  </head>\n"
      xml += "  <body>\n"
      for cast in g.db['podcasts'].find():
          v =  ( cast['title'], cast['url'] )
          xml += "    <outline text=\"%s\"  type=\"rss\" xmlUrl=\"%s\"/>\n" % v
      xml += "  </body>\n"
      xml += "</opml>\n"
      return xml


@app.route('/rmepisode/<id>', methods=['GET'])
def rmepisode(id):
    """Remove a single episode from the user's database."""
    if 'user_id' not in session:
        abort(401)
    else:
       res = g.db['episodes'].remove( { "_id" : ObjectId( id ) } )
       app.logger.debug("RemoveEp: " + str(res))
    return "ok"


@app.route('/getpos/<id>', methods=['GET'])
def getpos(id):
    """Get the users current position in the podcast user."""
    if 'user_id' not in session:
        abort(401)
    else:
      res = g.db['episodes'].find_one( { "_id" : ObjectId( id ) })
      if 'position' in res.keys():
        return res['position']
      else:
        return "0"


@app.route('/setpos/<id>/<pos>', methods=['GET'])
def setpos(id,pos):
    """Set the users current position in the podcast user."""
    if 'user_id' not in session:
        abort(401)
    else:
      res = g.db['episodes'].update( { "_id" : ObjectId( id ) },
                                     { "$set" : { "position" : pos } })
    return "ok"



@app.route('/')
def listen():
    """
    """
    if not g.user:
        return redir('login')

    combined = dict()
    for cast in g.db['podcasts'].find():
      hash = cast["hash"]
      matching = []
      for ep in g.db['episodes'].find(): 
        if ep['hash'] == hash:
          app.logger.debug("Adding: " + ep['link'])
          ep['resume'] = ( 'position' in ep.keys() )
          ep['new'] = (ep['status'] == "new")
          matching.append( ep )
      combined[cast["title"]] = matching



    return render_template( 'listen.html', podcasts=combined )

@app.route('/newcast', methods=['POST','GET'])
@app.route('/manage')
def manage():
    """Adds a podcast to a users feed's list."""

    if request.method == "GET":
      app.logger.debug("Rendering add")
      podcasts = g.db['podcasts'].find()
      return render_template( "add.html", podcasts = podcasts )
    else:
      if g.user and request.form['feed']:
        app.logger.debug("Parsing add")
        podcast = dict()
        url = request.form['feed']
        podcast['url'] = url

        hashable = url + datetime.utcnow().strftime('%Y-%m-%d @ %H:%M')
        podcast['hash'] = md5(hashable.strip().lower().encode('utf-8')).hexdigest()
        podcast['user'] = g.user

        rss = feedparser.parse( podcast['url'] )

        podcast['title'] = rss['feed']['title']
        podcast['subtitle'] = rss['feed']['subtitle']
        podcast['image'] = rss['feed']['image']['href']

        g.db['podcasts'].insert( podcast )

        hash = podcast['hash']
        mongoentries = []
        for entry in rss.entries:
          episode = dict()
          episode["hash"]   = hash
          episode["link"]   = entry['link']
          episode["date"]   = entry['updated']
          episode["title"]  = entry['title']
          episode["status"] = "new"
          app.logger.warn(" New documenet: " + str(episode) )

          mongoentries.append( episode )
        
        g.db['episodes'].insert( mongoentries )

        flash('Your subscription was successful')
      else:
        app.logger.debug("Skipping add")

      podcasts = g.db['podcasts'].find()
      return render_template( "add.html", podcasts = podcasts )

@app.route('/remove/<hash>', methods=['GET'])
def remove(hash):
    """Registers a new message for the user."""
    if 'user_id' not in session:
        abort(401)
    else:
        g.db['podcasts'].remove( { "hash" : hash } )
        g.db['episodes'].remove( { "hash" : hash } )
        flash('You successfully unsubscribed from the podcast')

 
    podcasts = g.db['podcasts'].find()
    return render_template( "add.html", podcasts = podcasts )


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Log the user in."""
    if g.user:
      return redir('listen')

    error = None
    if request.method == 'POST':
      username = request.form['username']
      password = request.form['password']
      result = g.db['users'].find_one( { "user" : username } )
      
      if result is None:
          error = 'Invalid username'
      elif not check_password_hash( result['hash'], password ):
        error = 'Invalid password'
      else:
        flash('You were logged in')
        session['user_id'] = result['id']
        return redir('listen')
    return render_template('login.html', error=error)


@app.route('/register', methods=['GET', 'POST'])
def register():
    """Register a new user."""
    if g.user:
        return redir('listen')
    error = None
    if request.method == 'POST':
        if not request.form['username']:
            error = 'You have to enter a username'
        elif not request.form['email'] or \
                 '@' not in request.form['email']:
            error = 'You have to enter a valid email address'
        elif not request.form['password']:
            error = 'You have to enter a password'
        elif request.form['password'] != request.form['password2']:
            error = 'The two passwords do not match'
        elif get_user_id(request.form['username']) is not None:
            error = 'The username is already taken'
        else:
            user = dict()
            user['user']  = request.form['username'] 
            user['hash']  = generate_password_hash( request.form['password'] )
            user['email'] = request.form['email']
            user['id']    = md5(os.urandom(256)).hexdigest()
            g.db['users'].insert( user )
            flash('You were successfully registered and can login now')
            return redir('login')
    return render_template('register.html', error=error)


@app.route('/logout')
def logout():
    """Log the user out."""
    flash('You were logged out')
    session.pop('user_id', None)
    return redir('login')


# add some filters to jinja
app.jinja_env.filters['datetimeformat'] = format_datetime
app.jinja_env.filters['gravatar'] = gravatar_url


if __name__ == '__main__':
    app.run(port=80)
