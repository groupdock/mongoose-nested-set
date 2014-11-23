/*globals require, exports, console */

'use strict';

var ObjectId = require('mongoose').Types.ObjectId;

exports.isObjectId = function(id) {
  if (!id) {return false; }
  try {
    if ('string' === typeof id) {
      new ObjectId(id);
    } else {
      new ObjectId(id.toString());
    }
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};

