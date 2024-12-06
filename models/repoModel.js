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
  },
  { collation: { locale: "en", strength: 2 } } // Collation to make the name field case-insensitive
);

// Create a unique index on the name field with collation to enforce case-insensitive uniqueness
RepositorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

const Repository = mongoose.model("Repository", RepositorySchema);

module.exports = Repository;
