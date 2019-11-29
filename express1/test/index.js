'use strict'

const assert = require('chai').assert

const app = require('../examples/index.js')
const request = require('supertest')(app)
describe('服务器测试', () => {
  it('GET /', (done) => {
    request
      .get('/')
      .expect(200)
      .end((err, res) => {
        console.log(res.text)
        if (err) 
          return done(err)
        assert.equal(res.text, 'root', 'res is wrong')
        done()
      })
  })

  it('GET /path', (done) => {
    request
      .get('/path')
      .expect(200)
      .end((err, res) => {
        console.log(res.text)
        if (err) 
          return done(err)
        assert.equal(res.text, 'path', 'res is wrong')
        done()
      })
  })
})