# mongoose-nested-set

A mongoose plugin implementing the nested set pattern for mongoose models

### Usage

```javascript
var mongoose = require('mongoose'),
    NestedSetPlugin = require('mongoose-nested-set'),
    Schema = mongoose.Schema;
    
mongoose.connect('mongodb://localhost/nested_set_test');

var UserSchema = new Schema({
  username: {type: String}
});

// Include plugin
UserSchema.plugin(NestedSetPlugin);

User = mongoose.model('User', UserSchema);
```

### Related Links/Resources

* [Mongoose Documentation] (http://mongoosejs.com/)
* [Mongoose Plugins] (http://mongoosejs.com/docs/plugins.html)
* [Tree used in test and examples] (https://github.com/groupdock/mongoose-nested-set/raw/master/docs/test_tree.png)
* [Nested Set Model] (http://en.wikipedia.org/wiki/Nested_set_model)
* [Storing Hierarchical Data in a Database Article] (http://www.sitepoint.com/hierarchical-data-database-1/)
* [Trees in MongoDB] (http://www.mongodb.org/display/DOCS/Trees+in+MongoDB)

### Authors

* Luc Castera [https://github.com/dambalah](https://github.com/dambalah)

### Sponsor

[Intellum] (http://www.intellum.com/)
