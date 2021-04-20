const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  id: {
    //id would normally be ObjectId
    type: Number,
    required: true,
    min: 1,
  },
  courseName: {
    type: String,
    required: true,
    minLength: 2,
    trun: true,
  },
  credits: {
    type: Number,
    required: true,
  },
  lecturer: {
    type: String,
    required: true,
    minLength: 3,
    trim: true,
  },
  noOfStudents: {
    type: Number,
    default: 0,
  },
  startDate: {
    type: Date,
    required: true,
  },
  noOfWeeks: {
    type: Number,
    default: 15,
  },
  lastUpdated: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
});

const Course = mongoose.model("course", courseSchema);

module.exports = { Course };
