var mongoose                = require("mongoose");
var passportLocalMongoose   = require("passport-local-mongoose");

var InfoSchema = new mongoose.Schema({
    username: String,
    firstname: String,
    lastname: String,
    friends: Array,
    requests: Array
})

InfoSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("Info", InfoSchema);