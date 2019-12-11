const debug = require('debug')('layer')('express:router:layer')
const pathRegexp = require('path-to-regexp').pathToRegexp;
exports = module.exports = Layer

/**
 * 采用设计模式中的工厂模式完成此类
 * 关系类，path对应的回调fn，path对应的fn为route实例对应的dispatch方法，在dispatch中遍历method对应的fn，找到符合条件的fn
 * 在route中是method对应的回调fn
 */

function Layer(path, options, fn) {
  if (!(this instanceof Layer)) {
    return new Layer(path, options, fn);
  }
  let opts = options || {}

  this.handle = fn
  this.params = undefined
  this.path = undefined
  this.regexp = pathRegexp(path, this.keys = [], opts) // path: /user/:id ,keys:[{name: id, , prefix: '/', ...}]
}

Layer.prototype.handle_request = function handle(req, res, next) {
  let fn = this.handle
  fn(req, res, next)
}

/* Layer.prototype.handle_error = function handle_error(err, req, res, next) {
  let fn = this.handle
  try {
    fn(err, req, res, next)
  } catch (err) {
    next(err)
  }
} */
Layer.prototype.match = function match(path) {
  let match
  if (path) {
    match = this
      .regexp
      .exec(path)
  }

  if (!match) {
    this.params = undefined
    this.path = undefined
    return false
  }

  this.params = {}
  this.path = match[0]
  if (this.keys) {
    let keys = this.keys
    let params = this.params
    for (let i = 1; i < match.length; i++) {
      let key = keys[i - 1]
      let prop = key.name
      let val = decode_param(match[i])

      if (val !== undefined) {
        params[prop] = val
      }
    }
  }
  return true
}

/**
 * 对传过来的编码过的值进行解码
 */
function decode_param(val) {
  if (typeof val !== 'string' || val.length === 0) {
    return val;
  }

  try {
    return decodeURIComponent(val);
  } catch (err) {
    if (err instanceof URIError) {
      err.message = 'Failed to decode param \'' + val + '\'';
      err.status = err.statusCode = 400;
    }

    throw err;
  }
}