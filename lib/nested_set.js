'use strict'

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var NestedSetPlugin = function(schema, options) {
  schema.add({ lft: {type: Number, min: 0} });
  schema.add({ rgt: {type: Number, min: 0} });
  schema.add({ parentId: {type: Schema.ObjectId} });
}

module.exports = NestedSetPlugin;
