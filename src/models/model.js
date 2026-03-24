import mongoose from "mongoose";

const { Schema, model } = mongoose;

/* ================= USER ================= */
const userSchema = new Schema(
  {
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const User = model("User", userSchema);

/* ================= ORGANIZATION ================= */
const organizationSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    memberCount: { type: Number, default: 0 },
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Organization = model("Organization", organizationSchema);

/* ================= BOARD ================= */
const boardSchema = new Schema(
  {
    name: { type: String, required: true },
    description: String,
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  },
  { timestamps: true }
);

const Board = model("Board", boardSchema);

/* ================= TASK ================= */
const taskSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["To Do", "In Progress", "Done"], default: "To Do" },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Task = model("Task", taskSchema);

export { User, Organization, Board, Task };