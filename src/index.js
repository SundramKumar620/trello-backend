import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Backend is running on port ${PORT}`);
    });
});

app.get("/", (req, res) => {
    return res.status(200).json({message:"Server Running Niggaa"})
})

