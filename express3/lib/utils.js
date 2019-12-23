const qs = require('qs')
const querystring = require('querystring')

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