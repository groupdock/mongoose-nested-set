/*globals require, module, console */

'use strict';

let mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    assert = require('assert'),
    async = require('async'),
    Helpers = require('./helpers'),
    NestedSetPlugin = require('../lib/nested_set');

let UserSchema,
    User;

let createUsers = function (organization, callback) {
    // see diagram in docs/test_tree.png for a representation of this tree
    let michael = new User({username: 'michael', organization: organization});

    let meredith = new User({username: 'meredith', parentId: michael._id, organization: organization});
    let jim = new User({username: 'jim', parentId: michael._id, organization: organization});
    let angela = new User({username: 'angela', parentId: michael._id, organization: organization});

    let kelly = new User({username: 'kelly', parentId: meredith._id, organization: organization});
    let creed = new User({username: 'creed', parentId: meredith._id, organization: organization});

    let phyllis = new User({username: 'phyllis', parentId: jim._id, organization: organization});
    let stanley = new User({username: 'stanley', parentId: jim._id, organization: organization});
    let dwight = new User({username: 'dwight', parentId: jim._id, organization: organization});

    let oscar = new User({username: 'oscar', parentId: angela._id, organization: organization});

    let users = [
        michael,
        meredith,
        jim,
        angela,
        kelly,
        creed,
        phyllis,
        stanley,
        dwight,
        oscar
    ];

    if (organization === 'B') {
        // Slightly different tree with less leaves
        users = [
            michael,
            meredith,
            jim,
            angela,
            kelly,
            phyllis,
            stanley,
            oscar
        ];
    }

    async.eachSeries(users, function (item, cb) {
        item.save(cb);
    }, callback);
};

describe('NestedSet#GroupingKey', function () {
    before(function (done) {
        async.series([
            function (callback) {
                mongoose.connect('mongodb://localhost/nested_set_test', {useNewUrlParser: true});
                mongoose.set('useCreateIndex', true);
                callback();
            },
            function (callback) {
                UserSchema = new Schema({
                    username: {type: String},
                    organization: {type: String}
                });
                UserSchema.plugin(NestedSetPlugin);
                User = mongoose.model('UserGrouping', UserSchema);
                callback();
            },
            function (callback) {
                createUsers('A', callback);
            },
            function (callback) {
                createUsers('B', callback);
            }
        ], function (err, results) {
            if (!err) done();
        });
    });

    after(function (done) {
        mongoose.connection.collections.usergroupings.drop(function (err) {
            mongoose.disconnect();

            done();
        });
    });

    it('is same', function (done) {
        assert.ok(User);
        assert.equal('function', typeof User);
        assert.equal('UserGrouping', User.modelName);
        done();
    });

    it('has created users for testing', function (done) {
        User.find(function (err, users) {
            if (err) {
                console.log(err);
            }
            assert.ok(!err);
            assert.ok(users);
            assert.ok(users instanceof Array);
            assert.equal(18, users.length);
            done();
        });
    });

    it('can read parentIds as ObjectIDs', function (done) {
        User.find({organization: 'A'}, function (err, users) {
            if (err) {
                console.log(err);
            }
            assert.ok(!err);
            users.forEach(function (user) {
                if (user.parentId) {
                    assert.ok(Helpers.isObjectId(user.parentId));
                }
            });
            done();
        });
    });

    it('rebuildTree should set lft and rgt based on parentIds (A)', function (done) {
        User.findOne({username: 'michael', organization: 'A'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.find({organization: 'A'}, function (err, users) {
                    // see docs/test_tree.png for the graphical representation of this tree with lft/rgt values
                    users.forEach(function (person) {
                        if (person.username === 'michael') {
                            assert.equal(1, person.lft);
                            assert.equal(20, person.rgt);
                        } else if (person.username === 'meredith') {
                            assert.equal(2, person.lft);
                            assert.equal(7, person.rgt);
                        } else if (person.username === 'jim') {
                            assert.equal(8, person.lft);
                            assert.equal(15, person.rgt);
                        } else if (person.username === 'angela') {
                            assert.equal(16, person.lft);
                            assert.equal(19, person.rgt);
                        } else if (person.username === 'kelly') {
                            assert.equal(3, person.lft);
                            assert.equal(4, person.rgt);
                        } else if (person.username === 'creed') {
                            assert.equal(5, person.lft);
                            assert.equal(6, person.rgt);
                        } else if (person.username === 'phyllis') {
                            assert.equal(9, person.lft);
                            assert.equal(10, person.rgt);
                        } else if (person.username === 'stanley') {
                            assert.equal(11, person.lft);
                            assert.equal(12, person.rgt);
                        } else if (person.username === 'dwight') {
                            assert.equal(13, person.lft);
                            assert.equal(14, person.rgt);
                        } else if (person.username === 'oscar') {
                            assert.equal(17, person.lft);
                            assert.equal(18, person.rgt);
                        }
                    });
                    done();
                });
            });
        });
    });

    it('rebuildTree should set lft and rgt based on parentIds (B)', function (done) {
        User.findOne({username: 'michael', organization: 'B'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.find({organization: 'B'}, function (err, users) {
                    // see docs/test_tree.png for the graphical representation of this tree with lft/rgt values
                    users.forEach(function (person) {
                        if (person.username === 'michael') {
                            assert.equal(1, person.lft);
                            assert.equal(16, person.rgt);
                        } else if (person.username === 'meredith') {
                            assert.equal(2, person.lft);
                            assert.equal(5, person.rgt);
                        } else if (person.username === 'jim') {
                            assert.equal(6, person.lft);
                            assert.equal(11, person.rgt);
                        } else if (person.username === 'angela') {
                            assert.equal(12, person.lft);
                            assert.equal(15, person.rgt);
                        } else if (person.username === 'kelly') {
                            assert.equal(3, person.lft);
                            assert.equal(4, person.rgt);
                        } else if (person.username === 'phyllis') {
                            assert.equal(7, person.lft);
                            assert.equal(8, person.rgt);
                        } else if (person.username === 'stanley') {
                            assert.equal(9, person.lft);
                            assert.equal(10, person.rgt);
                        } else if (person.username === 'oscar') {
                            assert.equal(13, person.lft);
                            assert.equal(14, person.rgt);
                        }
                    });
                    done();
                });
            });
        });
    });
});