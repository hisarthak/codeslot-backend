const mongoose = require("mongoose");
const { Schema } = mongoose;

const RepositorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    content: [
      {
        type: String,
      },
    ],
    visibility: {
      type: Boolean,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    issues: [
      {
        type: Schema.Types.ObjectId,
        ref: "Issue",
      },
    ],
    // New field to store usernames of users who starred the repository
    starredBy: [
      {
        type: String, // Store usernames directly as strings
      },
    ],
  },
  { timestamps: true } // Automatically manage createdAt and updatedAt fields
);

const Repository = mongoose.model("Repository", RepositorySchema);

module.exports = Repository;
