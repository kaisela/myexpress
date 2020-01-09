'use strict'
/**
 * route 模块，存放管理path值一定时的method和callback的关系数组
 */

const debug = require('debug')('express:router:route')
const Layer = require('./layer')
let methods = require('http').METHODS
const flatten = require('array-flatten').flatten

const slice = Array.prototype.slice
const toString = Object.prototype.toString;
module.exports = Route
/**
 * 采用设计模式中的工厂模式实现
 */

function Route(path) {
  this.path = path
  this.stack = [] //method fun对应数组,Layer实例
  this.methods = {}
}
/**
 * 对同一path对应的methods进行注册，存放入stack中
 */
methods.forEach((method) => {
  method = method.toLowerCase()

  Route.prototype[method] = function () {
    let handles = flatten(slice.call(arguments))

    for (let i = 0; i < handles.length; i++) {
      let handle = handles[i]
      if (typeof handle !== 'function') { // 如果handle不是function，则对外抛出异常
        let msg = `Route.${method}() requires a callback function but not a ${type}`
        throw new Error(msg)
      }

      debug('%s %o', method, this.path)

      let layer = new Layer('/', {}, handle) // 注册method和handle的关系
      layer.method = method

      this.methods[method] = true
      this
        .stack
        .push(layer)
    }
    return this
  }
})

/**
 * 遍历stack数组，并处理函数
 */
Route.prototype.dispatch = function dispatch(req, res, done) {
  let idx = 0
  let stack = this.stack
  if (stack.length === 0) {
    return done() // 函数出来完成之后，将执行入口交给母函数管理，此处的done为router handle中的next
  }

  let method = req
    .method
    .toLowerCase()
  req.route = this
  next()
  function next(err) {
    let layer = stack[idx++]
    if (!layer) { // 当循环完成，调回router handle中的next
      return done(err)
    }
    if (layer.method && layer.method !== method) { // 不符合要求，继续调用next进行遍历
      return next(err)
    }

    // 3:新增 加入错误处理
    if (err) {
      layer.handle_error(err, req, res, next)
    } else {
      layer.handle_request(req, res, next)
    }
  }

}
/**
 * 判断当前route实例是否有注册method方法
 */
Route.prototype._handles_method = function _handles_method(method) {
  return Boolean(this.methods[method.toLowerCase()])
}