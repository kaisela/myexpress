const express = require('../index.js')
const app = express()
app.listen(3000)

app.get('/path', function (req, res) {
  console.log('visite /test')
  res.end('path')
})
app.get('/', function (req, res) {
  console.log('visite /')
  res.end('root')
})

exports = module.exports = app