var express                 = require("express"),
    mongoose                = require("mongoose"),
    passport                = require("passport"),
    bodyParser              = require("body-parser"),
    User                    = require("./models/user"),
    Info                    = require("./models/userInfo"),db
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

//======================================
//ROUTES
//======================================

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
    Info.findOne({username: emailV}, (err, out) => { 
        if (err)
            console.log(err)
        else {
            res.render("profile", {info: out});
        }
    })
})

app.get("/profile/edit", isLoggedIn, function (req, res) {
    var emailV = req.cookies['rememberData'].email;
    Info.findOne({username: emailV}, (err, out) => { 
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

app.get("/friends", isLoggedIn, async function(req, res) {
    var emailV   = req.cookies['rememberData'].email;
    var friendsQ = getInfoQuery(emailV);
    friendsQ.then((query) => {
        var friends  = [];
        var requests = [];
        if (query.friends) {
            for (var i=0; i<= query.friends.length; i++) {
                if (query.friends[i])
                friends.push(query.friends[i]);
            }
        }
        if (query.requests) {
            for (var i=0; i<= query.requests.length; i++) {
                if (query.requests[i])
                requests.push(query.requests[i]);
            }
        }
        res.render("friends", {friends: friends, requests: requests}); 
    });
    
    
});
//used for test purposes to delete all friends in DB
app.get("/deleteFriends", (req, res) => {
    var Q = Info.find({}).exec();
    Q.then((query)=>{
        query.forEach((element)=>{
            element.friends = [];
            element.save();
        })
        res.redirect("/friends");
    })
})

//POST ===================================
app.post("/register", function(req, res){ //registers users if info is valid
    var reg = new Info({ //creates instance of user
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        username: req.body.username,
        friends: [],
        requests: []
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
        var cookinfo = { //create cookie with new login info
            email:   req.body.username,
            val:        cookieVal
        }
        res.cookie('rememberData', cookinfo, {maxAge: cookieAge});
        if (isLoggedIn) {
            res.redirect('/profile'); 
        }
    });

app.post("/profile/changepw", passport.authenticate("local", {failureRedirect: "/profile/changepw"}), (req, res) => {
        console.log("Successful registration");
            res.render("changepw", {validated: 'yes'});
    })

app.post("/friends", (req, res) => {                            //creates friend request
    var add = req.body.newFriend;
    var emailV = req.cookies['rememberData'].email;
    User.countDocuments({username: add}, (err,result) => {      //looks if user exists
        if (result == 1) {
            var query = Info.findOne({username: add}).exec();   //get query with request sender's info
            query.then((Q)=> {
                if (Q) {
                    Q.requests.push(emailV);                    //adds logged in user's email to request array 
                    Q.save();
                } else {
                    console.log("Q is undefined");
                }
            });
            res.redirect("friends");
        } else {
            console.log("That user does not exist");
            res.redirect("/friends");
        }
    });
    
})

//PUT ==================================
app.put("/friends/accept", (req, res) => {              //handles accepting friend requests
    var emailV = req.cookies['rememberData'].email;
    var sender = req.body.username;
    Info.findOne({username: emailV}, (err, result) => { //fetch record of logged user
        var Q = getInfoQuery(sender);
        Q.then((query) => {
            addFriendsArr(query, result, "your");       //adds info of request sender to user's friends arr

            var sendr = getInfoQuery(sender);
            sendr.then((sndr)=> {
                var Q2 = getInfoQuery(emailV);
                Q2.then((query) => {
                    addFriendsArr(query, sndr, "their");//adds user's info to request sender's friends arr
                    res.redirect("/friends") 
                })            
            })
        })
    })
})

app.put("/friends/reject", (req, res) => {                      //handles rejecting friend requests
    var receiver = req.cookies['rememberData'].email;
    var sender = req.body.username;
    var Q = getInfoQuery(receiver);                     
    Q.then((query)=> {
        spliceArr(query.requests, sender);                      //deletes the username of request sender from requests array
        query.save();
        res.redirect("/friends");
    })
})

app.put("/profile/edit", (req, res) => {                        //put route that handles profile editing
    if (verifyName(req.body.firstname, req.body.lastname)) {
        var emailV = req.cookies['rememberData'].email;
        var txtname = req.body.username;                        //value entered into the input field by user
        User.countDocuments({username: txtname}, function(err, result) { //count names with that email
            if (err) {
              console.log(err);
            } else {
                if (result == 0 || txtname === emailV) {           //determines if unique
                    User.findOne({username: emailV}, (err, userOut) => {    //update in User collection
                        if (err) {console.log(err)} else {if (userOut) {
                            userOut.username = txtname;
                            userOut.save();
                        } else {
                            console.log("user object not working");
                            res.redirect("/profile/edit");
                        }}   
                     });
                        var Q = getInfoQuery(emailV);
                            Q.then((user)=>{
                                updateInfo(user, req);
                                var cookinfo = {                                //update the cookie
                                    email:   req.body.username,
                                    val:     req.cookies["rememberData"].val
                                }
                                res.cookie('rememberData', cookinfo, {maxAge: cookieAge});
                                res.render("profile", {info: user});
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
                User.register(new User({username: req.cookies['rememberData'].email}), req.body.password, function(err, user){
                    if(err){
                        console.log(err);
                        return res.redirect("/profile");
                    };
                    res.redirect("/profile");
                });
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

//FUNCTIONS =============================
function getInfoQuery(emailV) {
    var q =  Info.findOne({username: emailV}).exec();
    return q;
}
function updateInfo(user, req) {
    if (user) {
        user.firstname = req.body.firstname;
        user.lastname = req.body.lastname;
        user.username = req.body.username;
        console.log("---Info updated");
        user.save();
    }
}

function addFriendsArr(query, result, string) { //adds the info from 'query' to the friends array in 'results'
        result['friends'].push({
            firstname: query['firstname'],
            lastname: query.lastname,
            username: query.username
        });
        console.log("Added "+result.friends[0].firstname+" "+result.friends[0].lastname+" to "+string+" friends");
        if (string === "your") {
            spliceArr(result.requests, query.username);
            result.save()
        } else if (string === "their")
            result.save()
 }
function spliceArr(arr, item) {                 //removes array element equal to the 'item' argument
    var pos;
    for (var i=0; i < arr.length; i++) {
        if (arr[i] === item) {
            pos = i;
        }
        arr.splice(pos, 1)  
    }
} 

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