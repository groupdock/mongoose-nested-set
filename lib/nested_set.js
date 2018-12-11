/*globals require, console, module */

'use strict';

const mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async');

const NestedSetPlugin = function (schema, options) {
    options = options || {};

    schema.add({lft: {type: Number, min: 0}});
    schema.add({rgt: {type: Number, min: 0}});

    // Allows level computong while editing the graph
    schema.add({lvl: {type: Number, min: 0, default: 0}});
    schema.index({lvl: 1});


    schema.add({parentId: {type: Schema.ObjectId}});

    schema.index({parentId: 1});
    schema.index({lft: 1, rgt: 1});
    schema.index({rgt: 1});

    let updateConditions = function (conditions, item) {
        if (options.groupingKey) {
            conditions[options.groupingKey] = item[options.groupingKey];
        }
        return conditions;
    };

    schema.pre('save', function (next) {
        let self = this;
        if (self.parentId) {
            self.parent(function (err, parentNode) {
                if (!err && parentNode && parentNode.lft && parentNode.rgt) {
                    //Update level based on parentNode level
                    self.lvl = parentNode.lvl + 1;
                    // find siblings and check if they have lft and rgt values set
                    self.siblings(function (err, nodes) {
                        if (nodes.every(function (node) {
                            return node.lft && node.rgt;
                        })) {
                            let maxRgt = 0;
                            nodes.forEach(function (node) {
                                if (node.rgt > maxRgt) {
                                    maxRgt = node.rgt;
                                }
                            });
                            if (nodes.length === 0) {
                                // if it is a leaf node, the maxRgt should be the lft value of the parent
                                maxRgt = parentNode.lft;
                            }
                            let conditions = updateConditions({lft: {$gt: maxRgt}}, self);
                            self.constructor.updateMany(conditions, {$inc: {lft: 2}}, {multi: true}, function (err, updatedCount) {
                                conditions = updateConditions({rgt: {$gt: maxRgt}}, self);
                                self.constructor.updateMany(conditions, {$inc: {rgt: 2}}, {multi: true}, function (err, updatedCount2) {
                                    self.lft = maxRgt + 1;
                                    self.rgt = maxRgt + 2;
                                    next();
                                });
                            });
                        } else {
                            // the siblings do not have lft and rgt set. This means tree was not build.
                            // warn on console and move on.
                            // console.log('WARNING: tree is not built for ' + modelName + ' nodes. Siblings does not have lft/rgt');
                            next();
                        }
                    });
                } else {
                    // parent node does not have lft and rgt set. This means tree was not built.
                    // warn on console and move on.
                    // console.log('WARNING: tree is not built for ' + modelName + ' nodes. Parent does not have lft/rgt');
                    next();
                }
            });
        } else {
            // no parentId is set, so ignore
            next();
        }
    });

    schema.pre('remove', function (next) {
        let self = this;
        if (self.parentId) {
            self.parent(function (err, parentNode) {
                if (!err && parentNode && parentNode.lft && parentNode.rgt) {

                    // find siblings and check if they have lft and rgt values set
                    self.siblings(function (err, nodes) {
                        if (nodes.every(function (node) {
                            return node.lft && node.rgt;
                        })) {
                            let maxRgt = 0;
                            nodes.forEach(function (node) {
                                if (node.rgt > maxRgt) {
                                    maxRgt = node.rgt;
                                }
                            });
                            if (nodes.length === 0) {
                                // if it is a leaf node, the maxRgt should be the lft value of the parent
                                maxRgt = parentNode.lft;
                            }
                            let conditions = updateConditions({lft: {$gt: maxRgt}}, self);
                            self.constructor.updateMany(conditions, {$inc: {lft: -2}}, {multi: true}, function (err, updatedCount) {
                                conditions = updateConditions({rgt: {$gt: maxRgt}}, self);
                                self.constructor.updateMany(conditions, {$inc: {rgt: -2}}, {multi: true}, function (err, updatedCount2) {
                                    next();
                                });
                            });
                        } else {
                            // the siblings do not have lft and rgt set. This means tree was not build.
                            // warn on console and move on.
                            // console.log('WARNING: tree is not built for ' + modelName + ' nodes. Siblings does not have lft/rgt');
                            next();
                        }
                    });
                } else {
                    // parent node does not have lft and rgt set. This means tree was not built.
                    // warn on console and move on.
                    // console.log('WARNING: tree is not built for ' + modelName + ' nodes. Parent does not have lft/rgt');
                    next();
                }
            });
        } else {
            // no parentId is set, so ignore
            next();
        }
    });

    // Builds the tree by populating lft and rgt using the parentIds
    schema.static('rebuildTree', function (parent, left, callback) {
        let self = this;
        parent.lft = left;
        parent.rgt = left + 1;

        self.find({parentId: parent._id}, function (err, children) {
            if (err) return callback(err);
            if (!children) return callback(new Error(self.constructor.modelName + ' not found'));

            if (children.length > 0) {
                async.eachSeries(children, function (item, cb) {
                    self.rebuildTree(item, parent.rgt, function () {
                        parent.rgt = item.rgt + 1;
                        self.updateOne({_id: parent._id}, {lft: parent.lft, rgt: parent.rgt}, cb);
                    });
                }, function (err) {
                    callback();
                });
            } else {
                self.updateOne({_id: parent._id}, {lft: parent.lft, rgt: parent.rgt}, callback);
            }
        });
    });

    // Returns true if the node is a leaf node (i.e. has no children)
    schema.method('isLeaf', function () {
        return this.lft && this.rgt && (this.rgt - this.lft === 1);
    });

    // Returns true if the node is a child node (i.e. has a parent)
    schema.method('isChild', function () {
        return !!this.parentId;
    });

    // Returns true if other is a descendant of self
    schema.method('isDescendantOf', function (other) {
        let self = this;
        return other.lft < self.lft && self.lft < other.rgt;
    });

    // Returns true if other is an ancestor of self
    schema.method('isAncestorOf', function (other) {
        let self = this;
        return self.lft < other.lft && other.lft < self.rgt;
    });

    // returns the parent node
    schema.method('parent', function (callback) {
        let self = this;
        self.constructor.findById(self.parentId, callback);
    });

    // Returns the list of ancestors + current node
    schema.method('selfAndAncestors', function (filters, fields, options, callback) {
        let self = this;
        if ('function' === typeof filters) {
            callback = filters;
            filters = {};
        }
        else if ('function' === typeof fields) {
            callback = fields;
            fields = null;
        }
        else if ('function' === typeof options) {
            callback = options;
            options = {};
        }

        filters = filters || {};
        fields = fields || null;
        options = options || {};

        if (filters['$query']) {
            filters['$query']['lft'] = {$lte: self.lft};
            filters['$query']['rgt'] = {$gte: self.rgt};
        } else {
            filters['lft'] = {$lte: self.lft};
            filters['rgt'] = {$gte: self.rgt};
        }
        self.constructor.find(filters, fields, options, callback);
    });

    // Returns the list of ancestors
    schema.method('ancestors', function (filters, fields, options, callback) {
        let self = this;
        if ('function' === typeof filters) {
            callback = filters;
            filters = {};
        }
        else if ('function' === typeof fields) {
            callback = fields;
            fields = null;
        }
        else if ('function' === typeof options) {
            callback = options;
            options = {};
        }

        filters = filters || {};
        fields = fields || null;
        options = options || {};

        if (filters['$query']) {
            filters['$query']['lft'] = {$lt: self.lft};
            filters['$query']['rgt'] = {$gt: self.rgt};
        } else {
            filters['lft'] = {$lt: self.lft};
            filters['rgt'] = {$gt: self.rgt};
        }
        self.constructor.find(filters, fields, options, callback);
    });

    // Returns the list of children
    schema.method('children', function (filters, fields, options, callback) {
        let self = this;
        if ('function' === typeof filters) {
            callback = filters;
            filters = {};
        }
        else if ('function' === typeof fields) {
            callback = fields;
            fields = null;
        }
        else if ('function' === typeof options) {
            callback = options;
            options = {};
        }

        filters = filters || {};
        fields = fields || null;
        options = options || {};

        if (filters['$query']) {
            filters['$query']['parentId'] = self._id;
        } else {
            filters['parentId'] = self._id;
        }
        self.constructor.find(filters, fields, options, callback);
    });

    // Returns the list of children + current node
    schema.method('selfAndChildren', function (filters, fields, options, callback) {
        let self = this;
        if ('function' === typeof filters) {
            callback = filters;
            filters = {};
        }
        else if ('function' === typeof fields) {
            callback = fields;
            fields = null;
        }
        else if ('function' === typeof options) {
            callback = options;
            options = {};
        }

        filters = filters || {};
        fields = fields || null;
        options = options || {};

        if (filters['$query']) {
            filters['$query']['$or'] = [{parentId: self._id}, {_id: self._id}];
        } else {
            filters['$or'] = [{parentId: self._id}, {_id: self._id}];
        }
        self.constructor.find(filters, fields, options, callback);
    });

    // Returns the list of descendants + current node
    schema.method('selfAndDescendants', function (filters, fields, options, callback) {
        let self = this;
        if ('function' === typeof filters) {
            callback = filters;
            filters = {};
        }
        else if ('function' === typeof fields) {
            callback = fields;
            fields = null;
        }
        else if ('function' === typeof options) {
            callback = options;
            options = {};
        }

        filters = filters || {};
        fields = fields || null;
        options = options || {};

        if (filters['$query']) {
            filters['$query']['lft'] = {$gte: self.lft};
            filters['$query']['rgt'] = {$lte: self.rgt};
        } else {
            filters['lft'] = {$gte: self.lft};
            filters['rgt'] = {$lte: self.rgt};
        }
        self.constructor.find(filters, fields, options, callback);
    });

    // Returns the list of descendants
    schema.method('descendants', function (filters, fields, options, callback) {
        let self = this;
        if ('function' === typeof filters) {
            callback = filters;
            filters = {};
        }
        else if ('function' === typeof fields) {
            callback = fields;
            fields = null;
        }
        else if ('function' === typeof options) {
            callback = options;
            options = {};
        }

        filters = filters || {};
        fields = fields || null;
        options = options || {};

        if (filters['$query']) {
            filters['$query']['lft'] = {$gt: self.lft};
            filters['$query']['rgt'] = {$lt: self.rgt};
        } else {
            filters['lft'] = {$gt: self.lft};
            filters['rgt'] = {$lt: self.rgt};
        }
        self.constructor.find(filters, fields, options, callback);
    });

    // Returns the list of all nodes with the same parent + current node
    schema.method('selfAndSiblings', function (filters, fields, options, callback) {
        let self = this;
        if ('function' === typeof filters) {
            callback = filters;
            filters = {};
        }
        else if ('function' === typeof fields) {
            callback = fields;
            fields = null;
        }
        else if ('function' === typeof options) {
            callback = options;
            options = {};
        }

        filters = filters || {};
        fields = fields || null;
        options = options || {};

        if (filters['$query']) {
            filters['$query']['parentId'] = self.parentId;
        } else {
            filters['parentId'] = self.parentId;
        }
        self.constructor.find(filters, fields, options, callback);
    });

    // Returns the list of all nodes with the same parent
    schema.method('siblings', function (filters, fields, options, callback) {
        let self = this;
        if ('function' === typeof filters) {
            callback = filters;
            filters = {};
        }
        else if ('function' === typeof fields) {
            callback = fields;
            fields = null;
        }
        else if ('function' === typeof options) {
            callback = options;
            options = {};
        }

        filters = filters || {};
        fields = fields || null;
        options = options || {};

        if (filters['$query']) {
            filters['$query']['parentId'] = self.parentId;
            filters['$query']['_id'] = {$ne: self._id};
        } else {
            filters['parentId'] = self.parentId;
            filters['_id'] = {$ne: self._id};
        }
        self.constructor.find(filters, fields, options, callback);
    });

    // Returns the level of this object in the tree. Root level is 0
    schema.method('level', function (callback) {
        let self = this;
        self.ancestors(function (err, nodes) {
            callback(err, nodes.length);
        });
    });
};

module.exports = exports = NestedSetPlugin;
