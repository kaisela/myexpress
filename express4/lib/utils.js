/**
 * 3:新增工具类文件
 */
const qs = require('qs')
const querystring = require('querystring')
/**
 *3:新增 根据val值 返回处理query中间件 转换query时需要的函数
 * @param {*} val
 */
exports.compileQueryParser = function compileQueryParser(val) {
  let fn
  if (typeof val === 'function') {
    return val
  }

  switch (val) {
    case true:
      fn = querystring.parse
      break
    case false:
      fn = newObject
      break
    case 'extended':
      fn = parseExtendedQueryString
      break
    case 'simple':
      fn = querystring.parse
      break
    default:
      throw new TypeError('unknown value for query parser function: ' + val)
  }
  return fn
}

function parseExtendedQueryString(str) {
  let fn = qs.parse(str, {allowPrototypes: true})
  return fn
}

function newObject() {
  return {}
}