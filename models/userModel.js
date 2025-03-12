const mongoose = require("mongoose");
const { Schema } = mongoose;


const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
  repositories: [
    {
      default: [],
      type: Schema.Types.ObjectId,
      ref: "Repository",
    },
  ],
  followedUsers: [
    {
      default: [],
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  starRepos: [
    {
      default: [],
      type: Schema.Types.ObjectId,
      ref: "Repository",
    },
  ],
  followers: [
    {
      default: [],
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to the `User` model for followers
    },
  ],
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
