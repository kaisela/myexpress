'use strict'
/**
 * 3:新增 处理req.url query部分的中间件
 */
let merge = require('utils-merge')
let parseUrl = require('parseurl')
let qs = require('qs')

module.exports = function query(options) {
  let opts = merge({}, options)
  let queryparse = qs.parse

  if (typeof options === 'function') {
    queryparse = options
    opts = undefined
  }

  if (opts !== undefined && opts.allowPrototypes === undefined) {
    opts.allowPrototypes = true
  }

  return function query(req, res, next) {
    if (!req.query) {
      let val = parseUrl(req).query
      req.query = queryparse(val, opts)
    }
    next()
  }
}