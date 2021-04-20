const mongoose = require('mongoose');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
// JWT secret token
const jwtSecret = "87915922460082594549ladaldasodköÖ1157729629";

const UserSchema = new mongoose.Schema({
   username: {
       type: String,
       required: true,
       minLength: 1,
       unique: true,
       trim: true,
   },
   email: {
       type: String,
       required: true,
       unique: true,
        trim: true,
        minLength: 3
   },
   password: {
       type: String,
       required: true,
       minLength: 8,
   },
   courseIds: [{
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'course',
    required: true}],
   userType: {
       type: String,
       enum: ['admin','student','lecturer']
   },
   sessions: [
       {
           token: {
               type: String,
               required: true
           },
           // UNIX TIMESTAMP
           expiresAt: {
               type: Number,
               required: true
           }
       }
   ]
});

/* INSTANCE METHODS */
UserSchema.methods.toJSON = function() {
    const user = this;
    const userObject = user.toObject();

    // return the document except password and sessions and other sensitive fields
    return _.omit(userObject, ['password', 'sessions']);
}

// Temporary access token that is stateless 
// Generated every 15 minutes per user
UserSchema.methods.generateAccessAuthToken = function() {
    const user = this;
    return new Promise((resolve, reject) => {
        // Create the JSON web token and return
        jwt.sign({_id: user._id.toHexString()}, jwtSecret, {
            expiresIn: "15m"
        }, (err, token) => {
            if(!err) {
                resolve(token);
            } else {
                reject(err);
            }
        });
    })
}

// Refresh token that is stored in the database
// Generated for every sessilon
UserSchema.methods.generateRefreshAuthToken = function() {
    // THis methods generate a 64 byte hex string - it does not 
    // save it to the database. saveSessionToDatabase() does that
    
    return new Promise((resolve, reject) => {
        crypto.randomBytes(64, (err, buffer) => {
            if(!err) {
                let token = buffer.toString('hex');
                resolve(token);
            }
            else reject(err);
        });
    });

}

// Creation of session once user logs in and stored into the database
UserSchema.methods.createSession = function() {
    let user = this;

    return user.generateRefreshAuthToken().then(refreshToken => {
        return saveSessionToDatabase(user, refreshToken)
        .then(refreshToken => {
            return refreshToken;
        })
        .catch(e => {
            return Promise.reject("Failed to create sesssion : " + e);
        })
    })
}

UserSchema.methods.addCourse = function(id) {
    let user = this;

    user.courseIds.push(id);
    return new Promise((resolve, reject) => {
        user.save().
        then(user => {
            resolve(user);
        })
        .catch(err => {
            reject(err);
        });
    })
   
}

/* MODEL METHODS (static) */

UserSchema.statics.getJWTSecret = function() {
    return jwtSecret;
}

UserSchema.statics.findByIdAndToken = function(_id, token) {
    let User = this;
    
    return User.findOne({
        _id: _id,
        'sessions.token': token
    })
}

UserSchema.statics.findByCredentials = function(email, password) {
    let User = this;

    return User.findOne({email}).then(user => {
        if(!user) {
            return Promise.reject();
        }
        
        return new Promise((resolve, reject) => {
            return bcrypt.compare(password, user.password, (err, doMatch)  => {
                    if(doMatch) resolve(user);
                    else reject();
            })
        })
    })
} 

UserSchema.statics.hasRefreshTokenExpired = (expiresAt) => {
    let secondsSinceEpoch = Date.now()/1000;

    if(expiresAt > secondsSinceEpoch) {
        return false; // has not expired
    } 
    else return true; // has expired
}


/* MIDDLEWARES */
// Runs before a user document is saved
// We dont store the user password in the database
UserSchema.pre('save', function(next) {
    let user = this;
    // Number of hashing rounds
    let costFactor = 10;

    if(user.isModified('password')) {
        // If the password fields has been changed run this password
        // Generate salt and hash password
        bcrypt.genSalt(costFactor, (err, salt) => {
            bcrypt.hash(user.password, salt, (err, hash ) => {
                user.password = hash;
                next();
            });
        });
    } else {
        next();
    }
})

/* HELPER METHODS */
let saveSessionToDatabase = (user, refreshToken) => {
    // save refresh toke nto the database
    return new Promise((resolve, reject) => {
        let expiresAt = generateRefreshTokenExpiryTime();
        user.sessions.push({ 'token': refreshToken, expiresAt});
    
        user.save().then(() => {
            // Allows to retrieve refresh token back
            //  Successfully save return the token
            resolve(refreshToken);
        })
        .catch(e => {
            reject(e);
        })
    });
}

let generateRefreshTokenExpiryTime = () => {
    let daysUntilExpire = "10";
    let secondsUntilExpires = daysUntilExpire * 24 * 60 * 60;
    return (Math.floor((Date.now()) / 1000)) + secondsUntilExpires;
}

const User = mongoose.model('user', UserSchema);
module.exports = {User};
