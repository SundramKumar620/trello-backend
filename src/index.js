import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import { User, Organization, Board, Task, OrganizationMember } from "./models/model.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { authMiddleware } from "./middleware.js"

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

app.post("/api/v1/organization", authMiddleware, async (req, res) => {
    try {
        const { name, description } = req.body
        const adminid = req.user.id


        if (!name || !description || !adminid) {
            return res.status(400).json({ message: "sab kuch chaiye bhai" })
        }

        const organizationexistname = await Organization.findOne({ name })

        if (organizationexistname) {
            return res.status(409).json({ message: "ye naam pehle se liya hua hai" })
        }

        const organization = await Organization.create({
            name,
            description,
            admin: adminid
        })

        return res.status(201).json({
            message: "organization ban gaya",
            organization
        })

    } catch (err) {
        return res.status(500).json({ message: "server phat gaya firse" })
    }
})

app.get("/api/v1/organization", authMiddleware, async (req, res) => {
    try {
        const organizations = await Organization.find({ admin: req.user.id })
        return res.status(200).json({
            message: "ye lo tumhari organizations",
            organizations
        })
    } catch (err) {
        return res.status(500).json({ message: "server phat gaya firse" })
    }
})

app.delete("/api/v1/organization/:id", authMiddleware, async (req, res) => {
    try {
        const id = req.params.id

        const deletedOrg = await Organization.findOneAndDelete({
            _id: id,
            admin: req.user.id
        })

        if (!deletedOrg) {
            return res.status(404).json({
                message: "ya to organization nahi mila ya tu admin nahi hai bhai"
            })
        }

        return res.status(200).json({
            message: "organization delete ho gaya bhai"
        })

    } catch (err) {
        return res.status(500).json({ message: "server phat gaya firse " })
    }
})

app.post("/api/v1/organization/add-member", authMiddleware, async (req, res) => {
    try {
        const { organizationId, memberEmail } = req.body

        if (!organizationId || !memberEmail) {
            return res.status(400).json({ message: "organizationId aur memberEmail dono chaiye" })
        }

        const memberexist = await User.findOne({ email: memberEmail })
        if (!memberexist) {
            return res.status(404).json({ message: "bhai user toh exist nahi karta" })
        }

        const organizationexist = await Organization.findOne({
            _id: organizationId,
            admin: req.user.id
        })
        if (!organizationexist) {
            return res.status(404).json({ message: "organization nahi mila bhai" })
        }

        const memberalready = await OrganizationMember.findOne({
            organization: organizationId,
            user: memberexist._id
        })
        if (memberalready) {
            return res.status(400).json({ message: "ye banda toh pehle se hi member hai bhai" })
        }

        const newmember = await OrganizationMember.create({
            organization: organizationId,
            user: memberexist._id
        })

        await Organization.findByIdAndUpdate(organizationId, {
            $inc: { memberCount: 1 }
        })

        return res.status(201).json({
            message: "member add ho gaya bhai ab maze kar",
            member: newmember
        })
    } catch (err) {
        return res.status(500).json({ message: "server phat gaya" })
    }
})

app.get("/api/v1/organization/members/:id", authMiddleware, async (req, res) => {
    try {
        const organizationId = req.params.id

        const organizationexist = await Organization.findOne({
            _id: organizationId,
            admin: req.user.id
        })

        if (!organizationexist) {
            return res.status(404).json({ message: "organization nahi mila bhai" })
        }

        const members = await OrganizationMember.find({ organization: organizationId }).populate("user", "email name")

        return res.status(200).json({
            message: "ye lo members ki list",
            members
        })
    } catch (err) {
        return res.status(500).json({ message: "server phat gaya" })
    }
})

app.delete("/api/v1/organization/remove-member", authMiddleware, async (req, res) => {
    const { memberEmail, organizationId } = req.body

    const organizationexist = await Organization.findOne({
        _id: organizationId,
        admin: req.user.id
    })

    if (!organizationexist) {
        return res.status(404).json({ message: "organization nahi mila bhai" })
    }

    const memberexist = await User.findOne({ email: memberEmail })
    if (!memberexist) {
        return res.status(404).json({ message: "user nahi mila bhai" })
    }

    const member = await OrganizationMember.findOneAndDelete({
        organization: organizationId,
        user: memberexist._id
    })

    if (!member) {
        return res.status(404).json({ message: "ye banda toh member hi nahi tha bhai" })
    }

    await Organization.findByIdAndUpdate(organizationId, {
        $inc: { memberCount: -1 }
    })

    return res.status(200).json({
        message: "member delete ho gaya bhai"
    })

})


