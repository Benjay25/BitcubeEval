var mongoose                = require("mongoose");
var passportLocalMongoose   = require("passport-local-mongoose");

var InfoSchema = new mongoose.Schema({
    email: String,
    firstname: String,
    lastname: String
})

InfoSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("Info", InfoSchema);