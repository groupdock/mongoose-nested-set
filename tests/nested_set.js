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

before(function (done) {
    async.series([
        function (callback) {
            mongoose.connect('mongodb://localhost/nested_set_test', {useNewUrlParser: true});
            mongoose.set('useCreateIndex', true);
            callback();
        },
        function (callback) {
            UserSchema = new Schema({
                username: {type: String}
            });
            UserSchema.plugin(NestedSetPlugin);
            User = mongoose.model('User', UserSchema);
            callback(null);
        },
        function (callback) {
            // see diagram in docs/test_tree.png for a representation of this tree
            let michael = new User({username: 'michael'});

            let meredith = new User({username: 'meredith', parentId: michael._id});
            let jim = new User({username: 'jim', parentId: michael._id});
            let angela = new User({username: 'angela', parentId: michael._id});

            let kelly = new User({username: 'kelly', parentId: meredith._id});
            let creed = new User({username: 'creed', parentId: meredith._id});

            let phyllis = new User({username: 'phyllis', parentId: jim._id});
            let stanley = new User({username: 'stanley', parentId: jim._id});
            let dwight = new User({username: 'dwight', parentId: jim._id});

            let oscar = new User({username: 'oscar', parentId: angela._id});

            async.eachSeries([
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
            ], function (item, cb) {
                item.save(cb);
            }, callback);
        }
    ], function (err, results) {
        if (!err) done();
    });
});

after(function (done) {
    mongoose.connection.collections.users.drop(function (err) {
        mongoose.disconnect();
    });
    done();
});

describe('Normal nested set', function () {
    it('is same', function (done) {
        assert.ok(User);
        assert.equal('function', typeof User);
        assert.equal('User', User.modelName);
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
            assert.equal(10, users.length);
            done();
        });
    });

    it('can read parentIds as ObjectIDs', function (done) {
        User.find(function (err, users) {
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

    it('rebuildTree should set lft and rgt based on parentIds', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function (err) {
                if (err) console.log(err);
                User.find({}, function (err, users) {
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

    it('isLeaf should return true if node is leaf', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'kelly'}, function (err, kelly) {
                    assert.ok(kelly.isLeaf());
                    User.findOne({username: 'michael'}, function (err, michael) {
                        assert.ok(!michael.isLeaf());
                        done();
                    });
                });
            });
        });
    });

    it('isChild should return true if node has a parent', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'kelly'}, function (err, kelly) {
                    assert.ok(kelly.isChild());
                    User.findOne({username: 'michael'}, function (err, michael) {
                        assert.ok(!michael.isChild());
                        done();
                    });
                });
            });
        });
    });

    it('parent should return parent node', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'kelly'}, function (err, kelly) {
                    assert.ok(!err);
                    assert.ok(kelly);
                    kelly.parent(function (err, node) {
                        assert.ok(!err);
                        assert.equal('meredith', node.username);
                        done();
                    });
                });
            });
        });
    });

    it('selfAndAncestors should return all ancestors higher up in tree + current node', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'kelly'}, function (err, kelly) {
                    kelly.selfAndAncestors(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual(['kelly', 'meredith', 'michael'], people.map(function (p) {
                            return p.username;
                        }).sort());
                        done();
                    });
                });
            });
        });
    });

    it('ancestors should return all ancestors higher up in tree', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'kelly'}, function (err, kelly) {
                    kelly.ancestors(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual(['meredith', 'michael'], people.map(function (p) {
                            return p.username;
                        }).sort());
                        done();
                    });
                });
            });
        });
    });

    it('ancestors should return empty array if it is a root node', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'michael'}, function (err, michael) {
                    michael.ancestors(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual([], people.map(function (p) {
                            return p.username;
                        }).sort());
                        done();
                    });
                });
            });
        });
    });

    it('selfAndChildren should return all children + current node', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'michael'}, function (err, michael) {
                    michael.selfAndChildren(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual(['angela', 'jim', 'meredith', 'michael'], people.map(function (p) {
                            return p.username;
                        }).sort());
                        done();
                    });
                });
            });
        });
    });

    it('children should return all children', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'michael'}, function (err, michael) {
                    michael.children(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual(['angela', 'jim', 'meredith'], people.map(function (p) {
                            return p.username;
                        }).sort());
                        done();
                    });
                });
            });
        });
    });

    it('selfAndDescendants should return all descendants + current node', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'michael'}, function (err, michael) {
                    michael.selfAndDescendants(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual(
                            ['angela', 'creed', 'dwight', 'jim', 'kelly', 'meredith', 'michael', 'oscar', 'phyllis', 'stanley'],
                            people.map(function (p) {
                                return p.username;
                            }).sort()
                        );
                        done();
                    });
                });
            });
        });
    });

    it('descendants should return all descendants', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'michael'}, function (err, michael) {
                    michael.descendants(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual(
                            ['angela', 'creed', 'dwight', 'jim', 'kelly', 'meredith', 'oscar', 'phyllis', 'stanley'],
                            people.map(function (p) {
                                return p.username;
                            }).sort()
                        );
                        done();
                    });
                });
            });
        });
    });

    it('level should return 0 for root node', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'michael'}, function (err, michael) {
                    michael.level(function (err, value) {
                        assert.ok(!err);
                        assert.equal(0, value);
                        done();
                    });
                });
            });
        });
    });

    it('selfAndSiblings should return all nodes with same parent node + current node', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'meredith'}, function (err, meredith) {
                    meredith.selfAndSiblings(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual(
                            ['angela', 'jim', 'meredith'],
                            people.map(function (p) {
                                return p.username;
                            }).sort()
                        );
                        done();
                    });
                });
            });
        });
    });

    it('siblings should return all nodes with same parent node', function (done) {
        User.findOne({username: 'michael'}, function (err, user) {
            User.rebuildTree(user, 1, function () {
                User.findOne({username: 'meredith'}, function (err, meredith) {
                    meredith.siblings(function (err, people) {
                        assert.ok(!err);
                        assert.deepEqual(
                            ['angela', 'jim'],
                            people.map(function (p) {
                                return p.username;
                            }).sort()
                        );
                        done();
                    });
                });
            });
        });
    });

    it('kelly is a descendant of michael', function (done) {
        User.findOne({username: 'michael'}, function (err, michael) {
            User.rebuildTree(michael, 1, function () {
                User.findOne({username: 'kelly'}, function (err, kelly) {
                    assert.ok(kelly.isDescendantOf(michael));
                    assert.ok(!michael.isDescendantOf(kelly));
                    done();
                });
            });
        });
    });

    it('michael is an ancestor of kelly', function (done) {
        User.findOne({username: 'michael'}, function (err, michael) {
            User.rebuildTree(michael, 1, function () {
                User.findOne({username: 'kelly'}, function (err, kelly) {
                    assert.ok(michael.isAncestorOf(kelly));
                    assert.ok(!kelly.isAncestorOf(michael));
                    done();
                });
            });
        });
    });

    it('pre save middleware should not set lft and rgt if there is no parentId', function (done) {
        let user = new User({
            username: 'joe'
        });

        user.save(function (err, joe) {
            assert.ok(!err);
            assert.equal('joe', joe.username);
            assert.ok(!joe.lft);
            assert.ok(!joe.rgt);

            user.remove(); // Remove user after assertion

            done();
        });
    });

    it('adding a new node to a built tree should re-arrange the tree correctly', function (done) {
        User.findOne({username: 'michael'}, function (err, michael) {
            User.rebuildTree(michael, 1, function () {
                User.findOne({username: 'creed'}, function (err, creed) {
                    //console.log(creed);
                    let newUser = new User({
                        username: 'joe',
                        parentId: creed._id
                    });
                    newUser.save(function (err, joe) {
                        User.find(function (err, users) {
                            // see docs/test_tree_after_leaf_insertion.png for the graphical representation of this tree
                            // with lft/rgt values after the insertion
                            users.forEach(function (person) {
                                if (person.username === 'michael') {
                                    assert.equal(1, person.lft);
                                    assert.equal(22, person.rgt);
                                } else if (person.username === 'meredith') {
                                    assert.equal(2, person.lft);
                                    assert.equal(9, person.rgt);
                                } else if (person.username === 'jim') {
                                    assert.equal(10, person.lft);
                                    assert.equal(17, person.rgt);
                                } else if (person.username === 'angela') {
                                    assert.equal(18, person.lft);
                                    assert.equal(21, person.rgt);
                                } else if (person.username === 'kelly') {
                                    assert.equal(3, person.lft);
                                    assert.equal(4, person.rgt);
                                } else if (person.username === 'creed') {
                                    assert.equal(5, person.lft);
                                    assert.equal(8, person.rgt);
                                } else if (person.username === 'phyllis') {
                                    assert.equal(11, person.lft);
                                    assert.equal(12, person.rgt);
                                } else if (person.username === 'stanley') {
                                    assert.equal(13, person.lft);
                                    assert.equal(14, person.rgt);
                                } else if (person.username === 'dwight') {
                                    assert.equal(15, person.lft);
                                    assert.equal(16, person.rgt);
                                } else if (person.username === 'oscar') {
                                    assert.equal(19, person.lft);
                                    assert.equal(20, person.rgt);
                                } else if (person.username === 'joe') {
                                    assert.equal(6, person.lft);
                                    assert.equal(7, person.rgt);
                                }
                            });
                            done();
                        });
                    });
                });
            });
        });
    });

    it('removing a node to a built tree should re-arrange the tree correctly', function (done) {
        User.findOne({username: 'michael'}, function(err, michael) {
            User.rebuildTree(michael, 1, function() {
                User.findOne({username: 'creed'}, function(err, creed) {
                    creed.remove(function() {
                        User.find(function(err, users) {
                            // see docs/test_tree_after_leaf_insertion.png for the graphical representation of this tree
                            // with lft/rgt values after the insertion
                            users.forEach(function(person) {
                                if (person.username === 'michael') {
                                    assert.equal(1, person.lft);
                                    assert.equal(18, person.rgt);
                                } else if (person.username === 'meredith') {
                                    assert.equal(2, person.lft);
                                    assert.equal(5, person.rgt);
                                } else if (person.username === 'jim') {
                                    assert.equal(6, person.lft);
                                    assert.equal(13, person.rgt);
                                } else if (person.username === 'angela') {
                                    assert.equal(14, person.lft);
                                    assert.equal(17, person.rgt);
                                } else if (person.username === 'kelly') {
                                    assert.equal(3, person.lft);
                                    assert.equal(4, person.rgt);
                                } else if (person.username === 'phyllis') {
                                    assert.equal(7, person.lft);
                                    assert.equal(8, person.rgt);
                                } else if (person.username === 'stanley') {
                                    assert.equal(9, person.lft);
                                    assert.equal(10, person.rgt);
                                } else if (person.username === 'dwight') {
                                    assert.equal(11, person.lft);
                                    assert.equal(12, person.rgt);
                                } else if (person.username === 'oscar') {
                                    assert.equal(15, person.lft);
                                    assert.equal(16, person.rgt);
                                }
                            });
                            done();
                        });
                    });
                });
            });
        });
    });
});