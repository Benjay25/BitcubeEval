var express                 = require("express"),
    mongoose                = require("mongoose"),
    passport                = require("passport"),
    bodyParser              = require("body-parser"),
    User                    = require("./models/user"),
    Info                    = require("./models/userInfo"),
    bcrypt                  = require("bcrypt"),
    LocalStrategy           = require("passport-local"),
    passportLocalMongoose   = require("passport-local-mongoose"),
    cookieParser            = require("cookie-parser"),
    methodOverride          = require("method-override"),
    flash                   = require("express-flash")

var cookieAge = (1000*60*60*24*10); //final number is the num days cookie will last
mongoose.connect("mongodb://localhost:27017/bitcube_as", { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true });
mongoose.set('useUnifiedTopology', true);
var app = express();
app.set('view engine', 'ejs');

app.use(require("express-session")({
    secret: "BitcubeIsTheSecret!",
    resave: true,
    saveUninitialized: true
}));

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(cookieParser());
app.use(methodOverride("_method"));

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//===================
//ROUTES
//===================

//GET
app.get("/", function (req, res) {
    res.redirect("/home");
})

app.get("/register", function (req, res) {
    res.render("register");
})

app.get("/login", function (req, res) {
    var checkVal = req.cookies['rememberData'];
    res.render("login",{value: checkVal});
})

app.get("/home", function (req, res) {
    res.render("home");
})

app.get("/profile", isLoggedIn, function (req, res) {
    var emailV = req.cookies['rememberData'].email;
    Info.findOne({email: emailV}, (err, out) => {
        if (err)
            console.log(err)
        else {
            res.render("profile", {info: out});
        }
    })
})

app.get("/profile/edit", isLoggedIn, function (req, res) {
    var emailV = req.cookies['rememberData'].email;
    Info.findOne({email: emailV}, (err, out) => {
        if (err)
            console.log(err)
        else {
            res.render("profileEdit", {info: out});
        }
    })
})

app.get("/profile/changepw", isLoggedIn, (req,res) => {
    res.render("changepw", {validated: "no", username: req.cookies["rememberData"].email});
})

app.get("/logout", function(req, res) {
    req.logOut();
    res.redirect("/home");
});

app.get("/friends", isLoggedIn, function(req, res) {
    res.render("friends");
});

//POST
app.post("/register", function(req, res){ //registers users if info is valid
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
                                console.log("Information:\n"+reg);
                            }
                        });
                        res.redirect("/login");
                    } else {
                        console.log("Email is not unique");
                        res.redirect("/login");
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

app.post("/login", passport.authenticate("local", //logs valid users in
    {
        failureRedirect: "/login",
        failureFlash: true
    }), function(req, res) {
        var cookieVal = req.body.remember;
        if (cookieVal != 'on') {cookieVal="off";}
        var cookinfo = {
            email:   req.body.username,
            val:        cookieVal
        }
        res.cookie('rememberData', cookinfo, {maxAge: cookieAge});
        if (isLoggedIn) {
            res.redirect('/profile'); 
        }
    });

app.post("/profile/changepw",passport.authenticate("local", {failureRedirect: "/profile/changepw"}), (req, res) => {
        console.log("Successful registration");
            res.render("changepw", {validated: 'yes'});
    })

//PUT
app.put("/profile/edit", (req, res) => { //put route that handles profile editing
    if (verifyName(req.body.firstname, req.body.lastname)) {
        var emailV = req.cookies['rememberData'].email;
        User.countDocuments({username: req.body.username}, function(err, result) { //count names with that email
            if (err) {
              console.log(err);
            } else {
                if (result == 0 || req.body.username == emailV) { //determines if unique or is the currently signed in email
                    User.findOne({username: emailV}, (err, userOut) => { //update in User collection
                        if (err) {console.log(err)} else {if (userOut) {
                            userOut.username = req.body.username;
                            userOut.save();
                        } else {
                            console.log("user object not working");
                            res.redirect("/profile/edit");
                        }}   
                     });
                     Info.findOne({email: emailV}, (err, out) => { //update in Info collection
                        if (out) {
                            out.firstname = req.body.firstname;
                            out.lastname = req.body.lastname;
                            out.email = req.body.username;
                            out.username = req.body.username;
                            out.save();
                            var cookinfo = {
                                email:   out.username,
                                val:     req.cookies["rememberData"].val
                            }
                            res.cookie('rememberData', cookinfo, {maxAge: cookieAge});
                            res.render("profile", {info: out});
                        } else {
                            res.send("Nothing found");
                        }
                    }); 
                     
                } else {
                    console.log("Email is not unique");
                    res.redirect("/profile/edit");
                }
            }
          });
    } else {
        console.log("First and Last name fields cannot be blank");
        res.redirect("/profile/edit");
    }
})

app.put("/profile/changepw", (req, res) => { //PUT route that handles password changes
    if (req.body.password == req.body.password2) {
        if (verifyPw(req.body.password)) {
            User.deleteOne({username: req.cookies['rememberData'].email}, (err) => {
            });
            User.register(new User({username: req.cookies['rememberData'].email}), req.body.password, function(err, user){
                if(err){
                    console.log(err);
                    return res.redirect("/profile");
                };
                res.redirect("/profile");
            });
        } else {
            console.log("Password is invalid");
            res.render("changepw", {validated: "yes"});
        }
    } else {
        console.log("Passwords do not match");
        res.render("changepw", {validated: "yes"});
    }
});
//=======================================

app.listen(3000, function () { //runs the server
    console.log("Server now running...");
});

//FUNCTIONS ========================================================
function verifyName(fname, lname) {
    return !(fname === "" && lname === "")
}

function verifyPw(pw) {
    return ((pw.length>=6) && (/\d/.test(pw)) && (/\W/.test(pw)) && (/[A-Z]/.test(pw)) && (/[a-z]/.test(pw)));
    //using regular expressions to evaluate the validity of the password.
};

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
}