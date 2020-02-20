var express                 = require("express"),
    mongoose                = require("mongoose"),
    passport                = require("passport"),
    bodyParser              = require("body-parser"),
    User                    = require("./models/user"),
    Info                    = require("./models/userInfo"),
    LocalStrategy           = require("passport-local"),
    passportLocalMongoose   = require("passport-local-mongoose"),
    flash                   = require("express-flash")
    
mongoose.connect("mongodb://localhost:27017/bitcube_as", { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true });
mongoose.set('useUnifiedTopology', true);
var app = express();
app.set('view engine', 'ejs');

app.use(require("express-session")({
    secret: "BitcubeIsTheSecret!",
    resave: false,
    saveUninitialized: false
}));

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//===================
//ROUTES
//===================

//get
app.get("/", function (req, res) {
    res.redirect("/home");
})

app.get("/register", function (req, res) {
    res.render("register");
})

app.get("/home", function (req, res) {
    res.render("home");
})


//post
app.post("/register", function(req, res){
    var reg = new Info({ //creates instance of user
        email: req.body.username,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        username: req.body.username
    })
    if (verifyName(reg.firstname, reg.lastname)) { //ensure names are not blank
        if (verifyPw(req.body.password)) { //check password
            User.countDocuments({username: reg.username}, function(err, result) { //count names with that email
                if (err) {
                  console.log(err);
                } else {
                    if (result == 0) { //determines if unique
                        User.register(new User({username: req.body.username}), req.body.password, function(err, user){
                            if(err){
                                console.log(err);
                                return res.render('register');
                            }
                            passport.authenticate("local")(req, res, function(){
                                console.log("Successful registration");
                            });
                        });
                        reg.save(function(err, user){
                            if(err) {
                                    console.log(err);
                            } else {
                                console.log("Saved!");
                                console.log("Information:\n"+reg);
                            }
                        });
                        res.redirect("/home");
                    } else {
                        console.log("Email is not unique");
                        res.redirect("/register");
                    }
                }
              });       
        } else {
            console.log("Invalid password");
            res.redirect("/register");
        }
    } else {
        console.log("First and Last name fields cannot be blank");
        res.redirect("/register");
    }
});

//=======================================

app.listen(3000, function () { //runs the server
    console.log("Server now running...");
});

//FUNCTIONS =============================

function verifyName(fname, lname) {
    return !(fname === "" && lname === "")
}

function verifyPw(pw) {
    return ((pw.length>=6) && (/\d/.test(pw)) && (/\W/.test(pw)) && (/[A-Z]/.test(pw)) && (/[a-z]/.test(pw)));
    //using regular expressions to evaluate the validity of the password.
};