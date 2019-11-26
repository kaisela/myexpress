'use strict'
/* function add(x, y) {
  return x + y
} */
const assert = require('chai').assert
/* describe('加法函数测试', function addTest() {
  it('1 加 1 等于 2', () => {
    assert.equal(add(1, 1), 2)
  })
}) */
const app = require('../index.js')()
const request = require('supertest')(app)
describe('服务器测试', () => {
  it('GET info', () => {
    request
      .get('/')
      .expect(200)
      .end((err, res) => {
        if (err) 
          return done(err)
        assert.equal(res.text, 'Response From Server', 'res is wrong')
        done()
      })
  })
})