'use strict'

const assert = require('chai').assert

const app = require('../examples/index.js')
const request = require('supertest')(app)
describe('服务器测试', () => {
  // 如果走的不是examples中的get：/ 测试不通过
  it('GET /', (done) => {
    request
      .get('/')
      .expect(200)
      .end((err, res) => {
        if (err) 
          return done(err)
        assert.equal(res.text, 'root', 'res is wrong') // 根据response调用end方法时的输出为: root
        done()
      })
  })
  // 如果走的不是examples中的get：/path 测试不通过
  it('GET /path', (done) => {
    request
      .get('/path')
      .expect(200)
      .end((err, res) => {
        if (err) 
          return done(err)
        assert.equal(res.text, 'path', 'res is wrong') // 根据response调用end方法时的输出为: path
        done()
      })
  })
})
