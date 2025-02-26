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
    visibility: {
      type: Boolean,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  
    // Field to store usernames of users who starred the repository
    starredBy: [
      {
        type: String, // Store usernames directly as strings
      },
    ],
    // Each repository can have only one unique localSystemId
    localSystemId: {
      type: String,
      unique: true,  // Ensures no duplicate localSystemIds
      sparse: true,  // Allows some repositories to not have a localSystemId
    },
    // Push number with a default value of 0
    pushNumber: {
      type: Number,
      default: 0,
    },
    pullCheck:{
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true } // Automatically manage createdAt and updatedAt fields
);

const Repository = mongoose.model("Repository", RepositorySchema);

module.exports = Repository;
