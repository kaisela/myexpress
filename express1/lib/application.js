'use strict'

const http = require('http')
let app = exports = module.exports = {}

app.init = function init() {
  this.setting = {}
  this.paths = []
  this.defaultConfiguration()
}

app.defaultConfiguration = function defaultConfiguration() {
  let env = process.env.NODE_ENV || 'development'
  this.set('env', env)
  this.set('jsonp callback name', 'callback')
}

app.set = function set(key, val) {
  if (arguments.length === 1) {
    this.setting[key]
  }
  this.setting[key] = val
}

app.handle = function handle(req, res) {
  let pathURL = req.url
  for (let path of this.paths) {
    if (pathURL === path.pathURL) {
      path.cb(req, res)
    }
  }
}

app.listen = function listen() {
  let server = http.createServer(this)
  return server
    .listen
    .apply(server, arguments)
}
app.get = function get(path, cb) {
  console.log(path)
  let pathObj = {
    pathURL: path,
    cb: cb
  }
  this
    .paths
    .push(pathObj)
}