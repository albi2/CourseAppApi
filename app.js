const express = require("express");
const app = express();

const { mongoose } = require("./db/mongoose");

const bodyParser = require("body-parser");

// Load in the mongoose models
const { Course } = require("./db/models/course.model");
const { User } = require("./db/models/user.model");
const jwt = require('jsonwebtoken');
/* MIDDLEWARE */
// Load Middleware
app.use(bodyParser.json());

// Check whether request has a valid JWT token
// Every time the user wants to access the backend services
let authenticate = (req, res, next) => {
  let token = req.header('x-access-token');

  // Verify jwt
  jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
    if(err) {
      // JWT is not valid
      // Do not authenticate
      res.status(401).send(err);
    } else {
      // The user id was encoded inside the token
      // We can use this to get the courses of the user
      req.user_id = decoded._id;
      next();
    }
  });
}

// Verify refresh token middleware which will be verifying the session
// Everytime the user wants to access a new JWT we use this middleware
let verifySession = (req, res, next) => {
  let refreshToken = req.header('x-refresh-token');
  let _id = req.header('_id');

  User.findByIdAndToken(_id, refreshToken)
  .then(user => {
    // User could not be found
    if(!user) {
      return Promise.reject({
        'error': 'User not found. Make sure the id and refresh token are correct'
      });
    }

    // If user found the session exists in the database
    // Have to make sure the session has not expired
    req.user_id = user._id;
    req.userObject = user;
    req.refreshToken = refreshToken;

    let isSessionValid = false;

    user.sessions.forEach((session) => {
      if(session.token === refreshToken) {
        if(User.hasRefreshTokenExpired(session.expiresAt) === false) {
          // refresh token has not expired
          isSessionValid = true;
        }
      }
    })

    if(isSessionValid) next(); // The sessions is valid continue with the request
    else {
      return Promise.reject({
        'error': 'Refresh token has expired or the session is invalid!'
      });
    }
  })
  .catch(e => {
    res.status(401).send(e);
  })
};

/* END MIDDLEWARE */

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST, PUT, PATCH, DELETE, OPTIONS, HEAD"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-access-token"
  );
  res.header(
    "Access-Control-Expose-Headers",
    "x-access-token, x-refresh-token"
  );
  next();
});

/* ROUTE HANDLERS */

/* COURSE ROUTES */

/**
 * GET /courses
 * Purpose: Get all courses
 */

app.get("/all-courses", authenticate, (req, res) => {
  Course.find({})
  .then(courses => {
    res.send(courses);
  })
  .catch(err => {
    res.status(400).send(err);
  })
})

/**
 * GET /courses
 * Purpose: Get all the courses for this user
 */
app.get("/courses", authenticate, (req, res) => {
  // Get all the courses in the database that belong
  // to authenticated user and return them as an array
  User.findOne({_id: req.user_id})
  .then(user => {
    if(user) {
    return user.populate('courseIds')
    .execPopulate();
    }
    else res.sendStatus(401);
  })
  .then(user => {
    res.send(user.courseIds);
  })
  .catch(err => {
    res.status(400).send(err);
  });
});

/**
 * POST /courses
 * Create a course
 */
app.post("/courses", authenticate, (req, res) => {
  // Wamt the user to create a new course and return the new document back to the user
  // The list information (fields) will be passed via JSON request body
  let id = req.body.id;
  let courseName = req.body.courseName;
  let credits = req.body.credits;
  let lecturer = req.body.lecturer;
  let noOfStudents = req.body.noOfStudents;
  let startDate = new Date(req.body.startDate);
  let noOfWeeks = req.body.noOfWeeks;
  let lastUpdated = new Date(req.body.lastUpdated);
  let description = req.body.description;

  let newCourse = new Course({
    id: id,
    courseName: courseName,
    credits: credits,
    lecturer: lecturer,
    noOfStudents: noOfStudents,
    startDate: startDate,
    noOfWeeks: noOfWeeks,
    lastUpdated: lastUpdated,
    description: description,
  });

  newCourse.save().then((courseDoc) => {
    // The full list document is returned
    res.send(courseDoc);
  });
});

/**
 * PATCH /courses/:id
 * Purpose: Update a specified list
 */
app.patch("/courses/:id", authenticate, (req, res) => {
  // We want to update the specified course (id sent through req URL) wuth the new values
  // specified in the JSON body of the request
  Course.findOneAndUpdate(
    { _id: req.params.id },
    {
      $set: req.body,
    }
  ).then((updatedDoc) => {
    res.send({'message': 'Document updated'});
  })
  .catch(err => {
    res.status(400).send(err);
  })
});

/**
 * DELETE /lists/:id
 * Purpose: Delete a list
 */
app.delete("/courses/:id", (req, res) => {
  // We want to delete the specified list (document with id in the URL)
  Course.findOneAndRemove({
    _id: req.params.id,
  }).then((removedDoc) => {
    res.send(removedDoc);
  });
});


/**
 * PATCH /users/:courseId
 * Purpose: Enroll user into course
 */
app.patch('/users/:courseId', authenticate, (req, res) => {
  return Course.findOne({_id: req.params.courseId})
  .then(course => {
    if(course) {
      course.noOfStudents++;
      course.lastUpdated = new Date().toString();

      return course.save().
      then(course => {
        return true;
      })
      .catch(err => {
        return Promise.reject(err);
      })
    }
    return false;
  })
  .then((courseFound) => {
    if(courseFound) {
      User.findOne({_id: req.user_id})
      .then(user => {
        return user.addCourse(req.params.courseId);
      });
    }
    else res.sendStatus(404);
  })
  .then(user => {
    res.send({'message': 'User enrolled successfully!'});
  })
  .catch(err => {
    res.status(400).send(err);
  })
});

/* USER ROUTES */

/**
 * POST /users
 * Purpose: signup, create session() send user back to open log in page
 */
app.post('/users', (req, res) =>{
  let body = req.body;
  let newUser = new User(body);

  newUser.save().then(() => {
    return newUser.createSession();
  })
  .then(refreshToken => {
    // Refresh token has been created successfully
    // Now we have to create an auth access token(JWT) for the user
    return newUser.generateAccessAuthToken()
    .then(accessToken => {
        return { accessToken, refreshToken};
    })
  })
  .then(authTokens => {
    res
      .header('x-refresh-token', authTokens.refreshToken)
      .header('x-access-token', authTokens.accessToken)
      .send(newUser);
    })
  .catch(e => {
    res.status(400).send(e);
  })
});

/**
 * POST /users/login
 * Purpose: Log in
 */

app.post('/users/login', (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  User.findByCredentials(email, password).then(user => {
    return user.createSession().then(refreshToken => {
      // Session created successfully - got auth refresh token
      // Now we generate auth access token for user
        return user.generateAccessAuthToken()
        .then(accessToken => {
          return { accessToken, refreshToken};
        });
      })
    .then(authToken => {
      console.log(authToken);
      res
      .header('x-refresh-token', authToken.refreshToken)
      .header('x-access-token', authToken.accessToken)
      .send(user);
    });
  })
  .catch( (e) => {
    res.status(400).send(e);
  });
});

/**
 * GET /users/me/new-access-token
 * Purpose: Acquire new access token after current one expires
 */

app.get('/users/me/new-access-token', verifySession, (req, res) => {
  // We know that the user/caller is authenticated and the userObject is made available
  req.userObject.generateAccessAuthToken().then(accessToken => {
    // Provides the access token in the header and in the body
    res.header('x-access-token', accessToken).send({accessToken});
  })
  .catch(e => {
    res.status(400).send(e);
  })
});

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
