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
  // 如果走的不是examples中的get：/path 测试不通过;
  it('GET /path', (done) => {
    request
      .get('/path')
      .expect(200)
      .end((err, res) => {
        if (err) 
          return done(err)
        let json = JSON.parse(res.text)
        assert.equal(json.index, 1, 'didn`t visite the first route /path') // 查看是否调用了第一次的注册
        assert.equal(json.end, true, 'res is wrong') // 查看是否调用了第二次注册
        done()
      })
  })
  // 测试get: /get/:id 并输出{id:12}
  it('GET /get/:id', (done) => {
    request
      .get('/get/12')
      .expect(200)
      .end((err, res) => {
        if (err) 
          return done(err)
        let params = JSON.parse(res.text)
        assert.equal(params.id, 12, 'id is wrong') // 如果输出的不是传入的12，测试不通过
        done()
      })
  })
  // 如果走的不是examples中的post：/post/path 测试不通过
  it('POST /post/path', (done) => {
    request
      .post('/post/path')
      .expect(200)
      .end((err, res) => {
        if (err) 
          return done(err)
        assert.equal(res.text, 'post path', 'res is wrong') // 根据response调用end方法时的输出为: post path
        done()
      })
  })
})
