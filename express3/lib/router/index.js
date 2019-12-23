'use strict'

const debug = require('debug')('router')
const Route = require('./route')
const Layer = require('./layer')
let methods = require('http').METHODS
const parseUrl = require('parseurl')
const mixin = require('merge-descriptors')

const objectRegExp = /^\[object (\S+)\]$/
const slice = Array.prototype.slice
const toString = Object.prototype.toString

/**
 *
 */

let proto = module.exports = function (options) {
  let ops = options || {}
  function router(req, res, next) {
    router.handle(req, res, next)
  }

  mixin(router, proto)
  router.params = {}
  router._params = []
  router.stack = []
  return router
}

/**
 * 将path和route对应起来，并放进stack中，对象实例为layer
 */
proto.route = function route(path) {
  let route = new Route(path)
  let layer = new Layer(path, {
    end: true
  }, route.dispatch.bind(route))
  layer.route = route
  this
    .stack
    .push(layer)
  return route
}

/**
 * 遍历stack数组，并处理函数, 将res req 传给route
 */

proto.handle = function handle(req, res, out) {
  let self = this
  debug('dispatching %s %s', req.method, req.url)
  let idx = 0
  let stack = self.stack
  let url = req.url
  let done = out
  let paramcalled = {}
  next() //第一次调用next
  function next(err) {
    let layerError = err === 'route'
      ? null
      : err
    if (layerError === 'router') { //如果错误存在，再当前任务结束前调用最终处理函数
      setImmediate(done, null)
      return
    }

    if (idx >= stack.length) { // 遍历完成之后调用最终处理函数
      setImmediate(done, layerError)
      return
    }
    let path = getPathname(req)
    if (!path) {
      return done(layerError)
    }
    let layer
    let match
    let route
    while (match !== true && idx < stack.length) { //从数组中找到匹配的路由
      layer = stack[idx++]
      match = matchLayer(layer, path)
      route = layer.route
      if (typeof match !== 'boolean') {
        layerError = layerError || match
      }

      if (match !== true) {
        continue
      }
      if (!route) {
        continue
      }
      if (layerError) {
        match = false
        continue
      }
      let method = req.method
      let has_method = route._handles_method(method)
      if (!has_method) {
        match = false
        continue
      }
    }
    if (match !== true) { // 循环完成没有匹配的路由，调用最终处理函数
      return done(layerError)
    }
    req.params = Object.assign({}, layer.params) // 将解析的‘/get/:id’ 中的id剥离出来
    self.process_params(layer, paramcalled, req, res, function (err) {
      if (err) {
        return next(layerError || err)
      }
      if (route) {
        return layer.handle_request(req, res, next) //调用route的dispatch方法，dispatch完成之后在此调用next，进行下一次循环
      }

      trim_prefix(layer, layerError, '', path)
    })
  }

  function trim_prefix(layer, layerError, layerPath, path) {
    if (layerPath.length !== 0) {
      let c = path[layerPath.length]
      if (c && c !== '/' && c !== '.') 
        return next(layerError)
    }
    if (layerError) {
      layer.handle_error(layerError, req, res, next)
    } else {
      layer.handle_request(req, res, next)
    }
  }

}

/**
 * 获取除query部分的路径 例如： /get?id=12 --> /get
 */

function getPathname(req) {
  try {
    return parseUrl(req).pathname
  } catch (e) {
    return undefined
  }
}

/**
 * 判断url是否符合layer.path的规则
 */
function matchLayer(layer, path) {
  try {
    return layer.match(path);
  } catch (err) {
    return err;
  }
}

//对传过来的参数进行拦截，将参数拦截相关存入到params中，在handle中进行分解执行
proto.param = function param(name, fn) {
  if (typeof name === 'function') {
    this
      ._params
      .push(name)
    return
  }
  if (name[0] === ':') {
    name = name.substr(1)
  }
  let params = this._params
  let len = this._params.length
  let ret
  for (let i = 0; i < len; i++) {
    if (ret = params[i](name, fn)) {
      fn = ret
    }
  }
  (this.params[name] = this.params[name] || []).push(fn)
}
proto.process_params = function process_params(layer, called, req, res, done) {
  let params = this.params
  let keys = layer.keys
  let keysIndex = 0
  let key
  let name
  let paramcbIndex = 0
  let paramcallbacks
  let paramVal
  let paramCalled
  if (keys.length === 0) {
    return done()
  }

  function param(err) {
    if (err) {
      return done(err)
    }
    if (keysIndex >= keys.length) {
      return done()
    }
    key = keys[keysIndex++]
    name = key.name
    paramcbIndex = 0
    paramVal = req.params[name]
    paramcallbacks = params[name]
    paramCalled = called[name]
    if (paramVal === undefined || !paramcallbacks) {
      return param()
    }

    if (paramCalled) {
      req.params[name] = paramCalled.value
      return param()
    }

    called[name] = paramCalled = {
      value: paramVal
    }

    paramCallback()
  }

  function paramCallback(err) {
    let fn = paramcallbacks[paramcbIndex++]
    if (err) {
      return param(err)
    }
    if (!fn) {
      return param(err)
    }
    try {
      fn(req, res, paramCallback, paramVal, name)
    } catch (e) {
      paramCallback(e)
    }
  }
  param()
}

proto.use = function use(fn) {
  let path = '/'
  let offset = 0
  if (typeof fn !== 'function') {
    let arg = fn
    while (Array.isArray(arg) && arg.length != 0) {
      arg = arg[0]
    }
    if (typeof arg !== 'function') {
      offset = 1
      path = arg
    }
  }

  let callbacks = slice.call(arguments, offset)
  if (callbacks.length === 0) {
    throw new TypeError('Router.use() requires a middleware function')
  }

  for (let i = 0; i < callbacks.length; i++) {
    let fn = callbacks[i]
    if (typeof fn !== 'function') {
      throw new TypeError('Router.use() requires a middleware function but not a ' + gettype(fn))
    }
    let layer = new Layer(path, {
      strict: false,
      end: false
    }, fn)
    layer.route = undefined
    this
      .stack
      .push(layer)
  }
}

function gettype(obj) {
  let type = typeof obj

  if (type !== 'object') {
    return type
  }

  return toString
    .call(obj)
    .replace(objectRegExp, '$1')
}