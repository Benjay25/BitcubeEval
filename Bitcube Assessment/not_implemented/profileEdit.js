//This is code that I decided to leave out because while being non-essential, I find it to still be important.
//It is, however, unfinished and while I do think that using promises, I can get the coded to run in the intended way which
//will lead to the desired result, it will be incredibley time comsuming and therefore I have decided to not finish it.
//For more information on this subject, please read the 'Acknowledgement of Website flaws' word document.
//This code is simply here should anyone want to review my attempt and see where I went wrong.
//Related user defined functions are at the bottom
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
                            console.log("0 User login updated");
                            userOut.save();
                        } else {
                            console.log("user object not working");
                            res.redirect("/profile/edit");
                        }}   
                     });
                        var Q = getInfoQuery(emailV);
                            Q.then((user)=>{
                                updateInfo(user, req);
                                console.log("1 User info updated");
                                //I believe that my problem is the nested callback functions and them either not being named functions or them not being within promises
                                //specifically the fact that I make mongoose query calls within the foreach loops, which then run asynchronously
                                var updateFriends = new Promise(async (resolve, reject)=> {
                                    if (user) {
                                        var fe = new Promise(async (resolve, reject)=> {
                                            user.friends.forEach(async (element)=> {
                                                var Q = Info.findOne({username: element.username}).exec();
                                                await Q.then((friend)=> {
                                                    if (friend) {
                                                        if (getPos(friend.friends, emailV)) {
                                                        updateInfo(friend.friends[getPos(friend.friends, emailV)], req);
                                                        element.save();
                                                        }
                                                    } 
                                                })
                                            });
                                        resolve();
                                        })
                                        fe.then(()=>{
                                            console.log("2 Friends info updated");
                                    resolve();
                                        })
                                    }
                                })

                                updateRequests = new Promise (async (resolve, reject)=>{
                                    var Q = Info.find({}).exec();
                                        await Q.then((query)=> {
                                            if (query) {
                                                query.forEach((element)=>{
                                                    if (getPos(query.requests, emailV)) {
                                                    element.requests[getPos(element.requests, emailV)] = txtname;
                                                    console.log("---Request info updated");
                                                    element.save()
                                                    }
                                                })
                                            }
                                            })
                                            console.log("3 Requests info updated")  
                                        resolve();
                                    })
                                updateFriends.then(() => {
                                    updateRequests.then(()=>{
                                        var cookinfo = {                                //update the cookie
                                            email:   req.body.username,
                                            val:     req.cookies["rememberData"].val
                                        }
                                        res.cookie('rememberData', cookinfo, {maxAge: cookieAge});
                                        res.render("profile", {info: user}); 
                                    })
                                })
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

//all Functions
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