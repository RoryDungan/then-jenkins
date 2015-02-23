'use strict';

/* jshint expr: true */

/**
 * Module dependencies.
 */

var async = require('async');
var nock = require('nock');
var should = require('should');
var uuid = require('node-uuid');

var fixtures = require('./fixtures');
var helper = require('./helper');
var jenkins = require('../lib');

var ndescribe = helper.ndescribe;
var nit = helper.nit;

/**
 * Tests.
 */

describe('jenkins', function() {

  beforeEach(function() {
    this.url = process.env.JENKINS_TEST_URL || 'http://localhost:8080';
    this.nock = nock(this.url);
    this.jenkins = jenkins(this.url);
  });

  afterEach(function(done) {
    helper.teardown({ test: this }, done);
  });

  after(function(done) {
    helper.cleanup({ test: this }, done);
  });

  describe('build', function() {
    beforeEach(function(done) {
      helper.setup({ job: true, test: this }, done);
    });

    describe('get', function() {
      it('should return build details', function(done) {
        var self = this;

        var jobs = [];

        self.nock
          .post('/job/' + self.jobName + '/build')
          .reply(201, '', { location: 'http://localhost:8080/queue/item/1/' })
          .get('/job/' + self.jobName + '/1/api/json?depth=0')
          .reply(200, fixtures.buildGet);

        jobs.push(function(next) {
          self.jenkins.job.build(self.jobName)
            .then(function(number) {
              next(null, number);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        });

        jobs.push(function(next) {
          async.retry(
            100,
            function(next) {
              self.jenkins.build.get(self.jobName, 1)
                .then(function(data) {
                  data.should.have.property('number');
                  data.number.should.equal(1);

                  next();
                })
                .catch(function(err) {
                  if (err) setTimeout(function() { return next(err); }, 100);
                });
            },
            next
          );

        });

        async.series(jobs, done);
      });

      it('should return build log', function(done) {
        var self = this;

        var jobs = [];

        self.nock
          .post('/job/' + self.jobName + '/build')
          .reply(201, '', { location: 'http://localhost:8080/queue/item/1/' })
          .get('/job/' + self.jobName + '/1/consoleText')
          .reply(200, fixtures.consoleText, { 'Content-Type': 'text/plain;charset=UTF-8' });

        jobs.push(function(next) {
          self.jenkins.job.build(self.jobName)
            .then(function(number) {
              next(null, number);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        });

        jobs.push(function(next) {
          async.retry(
            100,
            function(next) {
              self.jenkins.build.log(self.jobName, 1)
                .then(function(data) {
                  data.should.be.String.and.containEql('Started by user anonymous');

                  next();
                })
                .catch(function(err) {
                  if (err) setTimeout(function() { return next(err); }, 100);
                });
            },
            next
          );

        });

        async.series(jobs, done);
      });

      nit('should get with options', function(done) {
        this.nock
          .get('/job/test/1/api/json?depth=1')
          .reply(200, fixtures.buildGet);

        this.jenkins.build.get('test', 1, { depth: 1 })
          .then(function(data) {
            data.should.have.property('number');
            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      nit('should return error when it does not exist', function(done) {
        this.nock
          .get('/job/test/2/api/json?depth=0')
          .reply(404);

        this.jenkins.build.get('test', 2)
          .then(function(data) {
            should.not.exist(data);
          })
          .catch(function(err) {
            should.exist(err);
            should.equal(err.message, 'jenkins: build.get: test 2 not found');

            done();
          });
      });
    });

    describe('stop', function() {
      it('should stop build', function(done) {
        var self = this;

        var jobs = [];

        self.nock
          .post('/job/' + self.jobName + '/build')
          .reply(201, '', { location: 'http://localhost:8080/queue/item/1/' })
          .get('/job/' + self.jobName + '/1/stop')
          .reply(302);

        jobs.push(function(next) {
          self.jenkins.job.build(self.jobName)
            .then(function(number) {
              next(null, number);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        });

        jobs.push(function(next) {
          async.retry(
            100,
            function(next) {
              self.jenkins.build.stop(self.jobName, 1)
                .then(function() {
                  next();
                })
                .catch(function(err) {
                  if (err) setTimeout(function() { return next(err); }, 100);
                });
            },
            next
          );

        });

        async.series(jobs, done);
      });
    });
  });

  describe('job', function() {
    beforeEach(function(done) {
      helper.setup({ job: true, test: this }, done);
    });

    describe('build', function() {
      it('should start build', function(done) {
        this.nock
          .post('/job/' + this.jobName + '/build')
          .reply(201, '', { location: 'http://localhost:8080/queue/item/5/' });

        this.jenkins.job.build(this.jobName)
          .then(function(number) {
            number.should.be.type('number');
            number.should.be.above(0);

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      it('should start build with token', function(done) {
        this.nock
          .post('/job/' + this.jobName + '/build?token=secret')
          .reply(201, '', { location: 'http://localhost:8080/queue/item/5/' });

        this.jenkins.job.build(this.jobName, { token: 'secret' })
          .then(function(number) {
            number.should.be.type('number');
            number.should.be.above(0);

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      nit('should work with parameters', function(done) {
        this.nock
          .post('/job/test/buildWithParameters?hello=world')
          .reply(201);

        var opts = { parameters: { hello: 'world' } };

        this.jenkins.job.build('test', opts)
          .then(function() {
            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      nit('should work with a token and parameters', function(done) {
        this.nock
          .post('/job/test/buildWithParameters?hello=world&token=secret')
          .reply(201);

        var opts = {
          parameters: { hello: 'world' },
          token: 'secret',
        };

        this.jenkins.job.build('test', opts)
          .then(function() {
            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });
    });

    describe('config', function() {
      it('should get job config', function(done) {
        this.nock
          .get('/job/' + this.jobName + '/config.xml')
          .reply(200, fixtures.jobCreate);

        this.jenkins.job.config(this.jobName)
          .then(function(config) {
            config.should.be.type('string');
            config.should.containEql('<project>');

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      it('should update config', function(done) {
        var self = this;

        self.nock
          .get('/job/' + self.jobName + '/config.xml')
          .reply(200, fixtures.jobCreate)
          .post('/job/' + self.jobName + '/config.xml')
          .reply(200)
          .get('/job/' + self.jobName + '/config.xml')
          .reply(200, fixtures.jobUpdate);

        var jobs = {};

        jobs.before = function(next) {
          self.jenkins.job.config(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        };

        jobs.update = ['before', function(next, results) {
          var config = results.before.replace(
            '<description>before</description>',
            '<description>after</description>'
          );

          self.jenkins.job.config(self.jobName, config)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.after = ['update', function(next) {
          self.jenkins.job.config(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.before.should.not.eql(results.after);
          results.after.should.containEql('<description>after</description>');

          done();
        });
      });
    });

    describe('copy', function() {
      it('should copy job', function(done) {
        var self = this;

        var name = self.jobName + '-new';

        self.nock
          .head('/job/' + name + '/api/json?depth=0')
          .reply(404)
          .post('/createItem?name=' + name + '&from=' + self.jobName + '&mode=copy')
          .reply(302)
          .head('/job/' + name + '/api/json?depth=0')
          .reply(200);

        var jobs = {};

        jobs.before = function(next) {
          self.jenkins.job.exists(name)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        };

        jobs.copy = ['before', function(next) {
          self.jenkins.job.copy(self.jobName, name)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.after = ['copy', function(next) {
          self.jenkins.job.exists(name)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.before.should.equal(false);
          results.after.should.equal(true);

          done();
        });
      });
    });

    describe('create', function() {
      it('should create job', function(done) {
        var self = this;

        var name = self.jobName + '-new';

        self.nock
          .head('/job/' + name + '/api/json?depth=0')
          .reply(404)
          .post('/createItem?name=' + name, fixtures.jobCreate)
          .reply(200)
          .head('/job/' + name + '/api/json?depth=0')
          .reply(200);

        var jobs = {};

        jobs.before = function(next) {
          self.jenkins.job.exists(name)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        };

        jobs.create = ['before', function(next) {
          self.jenkins.job.create(name, fixtures.jobCreate)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.after = ['create', function(next) {
          self.jenkins.job.exists(name)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.before.should.equal(false);
          results.after.should.equal(true);

          done();
        });
      });

      nit('should return an error if it already exists', function(done) {
        var error = 'a job already exists with the name "nodejs-jenkins-test"';

        this.nock
          .post('/createItem?name=test', fixtures.jobCreate)
          .reply(400, '', { 'x-error': error });

        this.jenkins.job.create('test', fixtures.jobCreate)
          .then(function() {})
          .catch(function(err) {
            should.exist(err);

            err.message.should.eql('jenkins: job.create: a job already exists with the name ' +
                                   '"nodejs-jenkins-test"');
            done();
          })
      });
    });

    describe('destroy', function() {
      it('should delete job', function(done) {
        var self = this;

        self.nock
          .head('/job/' + self.jobName + '/api/json?depth=0')
          .reply(200)
          .post('/job/' + self.jobName + '/doDelete')
          .reply(302)
          .head('/job/' + self.jobName + '/api/json?depth=0')
          .reply(404);

        var jobs = {};

        jobs.before = function(next) {
          self.jenkins.job.exists(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        };

        jobs.create = ['before', function(next) {
          self.jenkins.job.destroy(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.after = ['create', function(next) {
          self.jenkins.job.exists(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.before.should.equal(true);
          results.after.should.equal(false);

          done();
        });
      });

      nit('should return error on failure', function(done) {
        this.nock
          .post('/job/test/doDelete')
          .reply(200);

        this.jenkins.job.destroy('test')
          .then(function() {})
          .catch(function(err) {
            should.exist(err);

            err.message.should.eql('jenkins: job.destroy: failed to delete: test');

            done();
          });
      });
    });

    describe('disable', function() {
      it('should disable job', function(done) {
        var self = this;

        self.nock
          .get('/job/' + self.jobName + '/api/json?depth=0')
          .reply(200, fixtures.jobGet)
          .post('/job/' + self.jobName + '/disable')
          .reply(302)
          .get('/job/' + self.jobName + '/api/json?depth=0')
          .reply(200, fixtures.jobGetDisabled);

        var jobs = {};

        jobs.before = function(next) {
          self.jenkins.job.get(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        };

        jobs.create = ['before', function(next) {
          self.jenkins.job.disable(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.after = ['create', function(next) {
          self.jenkins.job.get(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.before.buildable.should.equal(true);
          results.after.buildable.should.equal(false);

          done();
        });
      });
    });

    describe('enable', function() {
      it('should enable job', function(done) {
        var self = this;

        self.nock
          .post('/job/' + self.jobName + '/disable')
          .reply(302)
          .get('/job/' + self.jobName + '/api/json?depth=0')
          .reply(200, fixtures.jobGetDisabled)
          .post('/job/' + self.jobName + '/enable')
          .reply(302)
          .get('/job/' + self.jobName + '/api/json?depth=0')
          .reply(200, fixtures.jobGet);

        var jobs = {};

        jobs.setup = function(next) {
          self.jenkins.job.disable(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        };

        jobs.before = ['setup', function(next) {
          self.jenkins.job.get(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.enable = ['before', function(next) {
          self.jenkins.job.enable(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.after = ['enable', function(next) {
          self.jenkins.job.get(self.jobName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.before.buildable.should.equal(false);
          results.after.buildable.should.equal(true);

          done();
        });
      });
    });

    describe('exists', function() {
      it('should not find job', function(done) {
        var name = this.jobName + '-nope';

        this.nock
          .head('/job/' + name + '/api/json?depth=0')
          .reply(404);

        this.jenkins.job.exists(name)
          .then(function(exists) {
            exists.should.equal(false);

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      it('should find job', function(done) {
        this.nock
          .head('/job/' + this.jobName + '/api/json?depth=0')
          .reply(200);

        this.jenkins.job.exists(this.jobName)
          .then(function(exists) {
            exists.should.equal(true);

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });
    });

    describe('get', function() {
      it('should not get job', function(done) {
        var name = this.jobName + '-nope';

        this.nock
          .get('/job/' + name + '/api/json?depth=0')
          .reply(404);

        this.jenkins.job.get(name)
          .then(function(data) {
            should.not.exist(data);
          })
          .catch(function(err) {
            should.exist(err);

            done();
          });
      });

      it('should get job', function(done) {
        this.nock
          .get('/job/' + this.jobName + '/api/json?depth=0')
          .reply(200, fixtures.jobGet);

        this.jenkins.job.get(this.jobName)
          .then(function(data) {
            should.exist(data);

            data.should.properties('name', 'url');

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      nit('should work with options', function(done) {
        this.nock
          .get('/job/test/api/json?depth=1')
          .reply(200, fixtures.jobCreate);

        this.jenkins.job.get('test', { depth: 1 })
          .then(function(data) {
            should.exist(data);
            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      nit('should return error when not found', function(done) {
        this.nock
          .get('/job/test/api/json?depth=0')
          .reply(404);

        this.jenkins.job.get('test')
          .then(function(data) {
            should.not.exist(data);
          })
          .catch(function(err) {
            should.exist(err);
            should.equal(err.message, 'jenkins: job.get: test not found');
            done();
          });
      });
    });

    describe('list', function() {
      it('should list jobs', function(done) {
        var self = this;

        self.nock
          .get('/api/json')
          .reply(200, fixtures.jobList);

        self.jenkins.job.list()
          .then(function(data) {
            should.exist(data);

            data.should.not.be.empty;

            data.forEach(function(job) {
              job.should.have.properties('name');
            });

            done();
          })
          .catch(function(err) {
             should.not.exist(err);
          });
      });

      nit('should handle corrupt responses', function(done) {
        var data = '"trash';

        this.nock
          .get('/api/json')
          .reply(200, data);

        this.jenkins.job.list()
          .then(function() {})
          .catch(function(err) {
            should.exist(err);
            should.exist(err.message);

            err.message.should.eql('jenkins: job.list: returned bad data');

            done();
          });
      });
    });
  });

  describe('node', function() {
    beforeEach(function(done) {
      helper.setup({ node: true, test: this }, done);
    });

    describe('config', function() {
      it('should get master config', function(done) {
        this.nock
          .get('/computer/(master)/config.xml')
          .reply(200, fixtures.nodeConfigMaster);

        this.jenkins.node.config('master')
          .then(function(data) {
            data.should.containEql('numExecutors');

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      it('should error on master update', function(done) {
        this.jenkins.node.config('master', 'xml')
          .then(function() {})
          .catch(function(err) {
            should.exist(err);

            err.message.should.eql('jenkins: node.config: master not supported');

            done();
          });
      });
    });

    describe('create', function() {
      it('should create node', function(done) {
        var name = 'test-node-' + uuid.v4();

        this.nock
          .post('/computer/doCreateItem?' + fixtures.nodeCreateQuery.replace(/{name}/g, name))
          .reply(302, '', { location: 'http://localhost:8080/computer/' });

        this.jenkins.node.create(name)
          .then(function() {
            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });
    });

    describe('destroy', function() {
      it('should delete node', function(done) {
        var self = this;

        self.nock
          .head('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200)
          .post('/computer/' + self.nodeName + '/doDelete')
          .reply(302, '')
          .head('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(404);

        var jobs = {};

        jobs.before = function(next) {
          self.jenkins.node.exists(self.nodeName)
            .then(function(exists) {
              next(null, exists);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        };

        jobs.destroy = ['before', function(next) {
          self.jenkins.node.destroy(self.nodeName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.after = ['destroy', function(next) {
          self.jenkins.node.exists(self.nodeName)
            .then(function(exists) {
              next(null, exists);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.before.should.equal(true);
          results.after.should.equal(false);

          done();
        });
      });
    });

    describe('disable', function() {
      it('should disable node', function(done) {
        var self = this;

        self.nock
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGet)
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGet)
          .post('/computer/' + self.nodeName + '/toggleOffline?offlineMessage=away')
          .reply(302, '')
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGetOffline)
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGetOffline)
          .post('/computer/' + self.nodeName + '/changeOfflineCause',
            'offlineMessage=update&json=%7B%22offlineMessage%22%3A%22update%22%7D&' +
            'Submit=Update%20reason')
          .reply(302, '')
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGetOfflineUpdate);

        var jobs = {};

        jobs.beforeDisable = function(next) {
          self.jenkins.node.get(self.nodeName)
            .then(function(node) {
              next(null, node);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        };

        jobs.disable = ['beforeDisable', function(next) {
          self.jenkins.node.disable(self.nodeName, 'away')
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.afterDisable = ['disable', function(next) {
          self.jenkins.node.get(self.nodeName)
            .then(function(node) {
              next(null, node);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        }];

        jobs.update = ['afterDisable', function(next) {
          self.jenkins.node.disable(self.nodeName, 'update')
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err);
            });
        }];

        jobs.afterUpdate = ['update', function(next) {
          self.jenkins.node.get(self.nodeName)
            .then(function(node) {
              next(null, node);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.beforeDisable.temporarilyOffline.should.equal(false);
          results.afterDisable.temporarilyOffline.should.equal(true);
          results.afterDisable.offlineCauseReason.should.equal('away');
          results.afterUpdate.temporarilyOffline.should.equal(true);
          results.afterUpdate.offlineCauseReason.should.equal('update');

          done();
        });
      });
    });

    describe('enable', function() {
      it('should enable node', function(done) {
        var self = this;

        self.nock
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGet)
          .post('/computer/' + self.nodeName + '/toggleOffline?offlineMessage=away')
          .reply(302, '')
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGetOffline)
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGetOffline)
          .get('/computer/' + self.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGet)
          .post('/computer/' + self.nodeName + '/toggleOffline?offlineMessage=')
          .reply(302, '');

        var jobs = {};

        jobs.disable = function(next) {
          self.jenkins.node.disable(self.nodeName, 'away')
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err)
            });
        };

        jobs.before = ['disable', function(next) {
          self.jenkins.node.get(self.nodeName)
            .then(function(node) {
              next(null, node);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        }];

        jobs.enable = ['before', function(next) {
          self.jenkins.node.enable(self.nodeName)
            .then(function(res) {
              next(null, res);
            })
            .catch(function(err) {
              next(err)
            });
        }];

        jobs.after = ['enable', function(next) {
          self.jenkins.node.get(self.nodeName)
            .then(function(node) {
              next(null, node);
            })
            .catch(function(err) {
              should.not.exist(err);
            });
        }];

        async.auto(jobs, function(err, results) {
          should.not.exist(err);

          results.before.temporarilyOffline.should.equal(true);
          results.after.temporarilyOffline.should.equal(false);

          done();
        });
      });
    });

    describe('exists', function() {
      it('should not find node', function(done) {
        var name = this.nodeName + '-nope';

        this.nock
          .head('/computer/' + name + '/api/json?depth=0')
          .reply(404);

        this.jenkins.node.exists(name)
          .then(function(exists) {
            exists.should.equal(false);

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      it('should find node', function(done) {
        this.nock
          .head('/computer/' + this.nodeName + '/api/json?depth=0')
          .reply(200);

        this.jenkins.node.exists(this.nodeName)
          .then(function(exists) {
            exists.should.equal(true);

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });
    });

    describe('get', function() {
      it('should get node details', function(done) {
        this.nock
          .get('/computer/' + this.nodeName + '/api/json?depth=0')
          .reply(200, fixtures.nodeGet);

        this.jenkins.node.get(this.nodeName)
          .then(function(node) {
            should.exist(node);

            node.should.have.properties('displayName');

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      it('should get master', function(done) {
        this.nock
          .get('/computer/(master)/api/json?depth=0')
          .reply(200, fixtures.nodeGet);

        this.jenkins.node.get('master')
          .then(function(node) {
            should.exist(node);

            node.should.have.properties('displayName');

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });
    });

    describe('list', function() {
      it('should list nodes', function(done) {
        this.nock
          .get('/computer/api/json?depth=0')
          .reply(200, fixtures.nodeList);

        this.jenkins.node.list()
          .then(function(nodes) {
            should.exist(nodes);

            nodes.should.be.instanceof(Array);
            nodes.should.not.be.empty;

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });
    });
  });

  describe('queue', function() {
    beforeEach(function(done) {
      helper.setup({ job: true, test: this }, done);
    });

    describe('list', function() {
      it('should list queue', function(done) {
        var self = this;

        self.nock
          .get('/queue/api/json?depth=0')
          .reply(200, fixtures.queueList)
          .post('/job/' + self.jobName + '/build')
          .reply(201, '', { location: 'http://localhost:8080/queue/item/124/' });

        var jobs = {};
        var stop = false;

        jobs.list = function(next) {
          async.retry(
            1000,
            function(next) {
              self.jenkins.queue.list()
                .then(function(queue) {
                  if (queue && !queue.length) {
                    return next(new Error('no queue'));
                  }

                  stop = true;

                  queue.should.be.instanceof(Array);

                  next();
                })
                .catch(function(err) {
                  next(err)
                });
            },
            next
          );
        };

        jobs.builds = function(next) {
          async.retry(
            1000,
            function(next) {
              if (stop) return next();

              self.jenkins.job.build(self.jobName)
                .then(function() {
                  if (!stop) return next(new Error('queue more'));

                  next();
                })
                .catch(function(err) {
                  if (err) return next(err);
                });
            },
            next
          );
        };

        async.parallel(jobs, function(err) {
          should.not.exist(err);

          done();
        });
      });
    });

    describe('get', function() {
      nit('should work', function(done) {
        this.nock
          .get('/computer/(master)/api/json?depth=0')
          .reply(200, fixtures.nodeGet);

        this.jenkins.node.get('master')
          .then(function(data) {
            should.exist(data);

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });

      it('should work with options', function(done) {
        this.nock
          .get('/queue/api/json?depth=1')
          .reply(200, fixtures.queueList);

        this.jenkins.queue.get({ depth: 1 })
          .then(function(data) {
            should.exist(data);

            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });
      });
    });

    ndescribe('cancel', function() {
      it('should work', function(done) {
        this.nock
          .post('/queue/items/1/cancelQueue', '')
          .reply(200);

        this.jenkins.queue.cancel(1)
          .then(function() {
            done();
          })
          .catch(function(err) {
            should.not.exist(err);
          });;
      });

      it('should return error on failure', function(done) {
        this.nock
          .post('/queue/items/1/cancelQueue', '')
          .reply(500);

        this.jenkins.queue.cancel(1)
          .then(function() {})
          .catch(function(err) {
            should.exist(err);

            done();
          });
      });
    });
  });
});
