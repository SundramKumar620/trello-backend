import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import { User, Organization, Board, Task } from "./models/model.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import {authMiddleware} from "./middleware.js"

dotenv.config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Backend is running on port ${PORT}`);
    });
});

app.get("/", authMiddleware, async (req, res) => {
    return res.status(200).json({ message: "Server Running Niggaa" })
})

app.post("/api/v1/signup", async (req, res) => {
    try {
        const { email, password } = req.body
        console.log(email, password)

        if (!email || !password) {
            return res.status(400).json({ message: "bhai email aur password dono daal" })
        }

        const existinguser = await User.findOne({ email })

        if (existinguser) {
            return res.status(409).json({ message: "email already hai bhai" })
        }

        const hashedpassword = await bcrypt.hash(password, 10)

        const user = await User.create({ email, password: hashedpassword })

        return res.status(201).json({
            message: "hogaya register, ab maze kar",
            user: {
                id: user._id,
                email: user.email
            }
        })

    } catch (err) {
        console.log(err)
        return res.status(500).json({ message: "server phat gaya" })
    }
})

app.post("/api/v1/login", async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: "bhai email aur password dono daal" })
        }

        const user = await User.findOne({ email: email.toLowerCase() })

        if (!user) {
            return res.status(404).json({ message: "bhai pehle signup kar" })
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password)

        if (!isPasswordMatch) {
            return res.status(401).json({ message: "password galat hai bhai" })
        }

        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        )

        return res.status(200).json({
            message: "login hogaya bhai",
            token
        })

    } catch (err) {
        return res.status(500).json({ message: "server firse phat gaya" })
    }
})