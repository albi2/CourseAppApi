// This file will connection logic to the mongoDB daabase

const mongoose = require("mongoose");

// Setting mongoose to use js Promises instead of bluebird
mongoose.Promise = global.Promise;
mongoose
  .connect(
    "mongodb+srv://Albi:frenkli1@cluster0.wa71l.mongodb.net/university?retryWrites=true&w=majority",
    { useNewUrlParser: true }
  )
  .then(() => {
    console.log("Connected to MongoDB successfully!");
  })
  .catch((err) => {
    console.log("Error while trying to connect to the database: ", err);
  });

// Preventing deprecation
mongoose.set("useCreateIndex", true);
mongoose.set("useFindAndModify", false);

module.exports = {
  mongoose,
};
