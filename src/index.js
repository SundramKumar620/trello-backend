import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import { User, Organization, Board, Task, OrganizationMember } from "./models/model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authMiddleware } from "./middleware.js";

dotenv.config();
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
});

// ==================== ROOT ====================
app.get("/", authMiddleware, async (req, res) => {
    return res.status(200).json({ message: "Server running" });
});

// ==================== SIGNUP ====================
app.post("/api/v1/signup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and password required" });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(409).json({ message: "Email already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ email, password: hashedPassword });

        return res.status(201).json({ message: "User registered", user: { id: user._id, email: user.email } });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

// ==================== LOGIN ====================
app.post("/api/v1/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and password required" });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });
        return res.status(200).json({ message: "Login successful", token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

// ==================== ORGANIZATION ====================
app.post("/api/v1/organization", authMiddleware, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !description) return res.status(400).json({ message: "Name and description required" });

        const exists = await Organization.findOne({ name });
        if (exists) return res.status(409).json({ message: "Organization name already exists" });

        const organization = await Organization.create({ name, description, admin: req.user.id });
        return res.status(201).json({ message: "Organization created", organization });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/v1/organization", authMiddleware, async (req, res) => {
    try {
        // Fetch orgs where user is admin OR member
        const adminOrgs = await Organization.find({ admin: req.user.id });
        const memberOrgIds = await OrganizationMember.find({ user: req.user.id }).distinct("organization");
        const memberOrgs = await Organization.find({ _id: { $in: memberOrgIds } });

        const organizations = [...adminOrgs, ...memberOrgs];
        return res.status(200).json({ message: "Your organizations", organizations });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

// ==================== ORGANIZATION MEMBERS ====================
app.post("/api/v1/organization/add-member", authMiddleware, async (req, res) => {
    try {
        const { organizationId, memberEmail } = req.body;
        if (!organizationId || !memberEmail) return res.status(400).json({ message: "organizationId and memberEmail required" });

        const organization = await Organization.findById(organizationId);
        if (!organization) return res.status(404).json({ message: "Organization not found" });
        if (organization.admin.toString() !== req.user.id) return res.status(403).json({ message: "Only admin can add members" });

        const user = await User.findOne({ email: memberEmail });
        if (!user) return res.status(404).json({ message: "User not found" });

        const exists = await OrganizationMember.findOne({ organization: organizationId, user: user._id });
        if (exists) return res.status(400).json({ message: "User already a member" });

        const member = await OrganizationMember.create({ organization: organizationId, user: user._id });
        await Organization.findByIdAndUpdate(organizationId, { $inc: { memberCount: 1 } });

        return res.status(201).json({ message: "Member added", member });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/v1/organization/members/:id", authMiddleware, async (req, res) => {
    try {
        const organizationId = req.params.id;
        const organization = await Organization.findById(organizationId);
        if (!organization) return res.status(404).json({ message: "Organization not found" });

        // Only admin or members can see
        const isAdmin = organization.admin.toString() === req.user.id;
        const isMember = await OrganizationMember.exists({ organization: organizationId, user: req.user.id });
        if (!isAdmin && !isMember) return res.status(403).json({ message: "Access denied" });

        const members = await OrganizationMember.find({ organization: organizationId }).populate("user", "email name");
        return res.status(200).json({ message: "Members list", members });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

// ==================== BOARDS ====================
app.post("/api/v1/boards", authMiddleware, async (req, res) => {
    try {
        const { name, description, organizationId } = req.body;
        if (!name || !description || !organizationId) return res.status(400).json({ message: "Name, description, organizationId required" });

        const organization = await Organization.findById(organizationId);
        if (!organization) return res.status(404).json({ message: "Organization not found" });
        if (organization.admin.toString() !== req.user.id) return res.status(403).json({ message: "Only admin can create boards" });

        const board = await Board.create({ name, description, organization: organizationId });
        return res.status(201).json({ message: "Board created", board });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/v1/boards/:organizationId", authMiddleware, async (req, res) => {
    try {
        const { organizationId } = req.params;
        const organization = await Organization.findById(organizationId);
        if (!organization) return res.status(404).json({ message: "Organization not found" });

        // Admin or member can view boards
        const isAdmin = organization.admin.toString() === req.user.id;
        const isMember = await OrganizationMember.exists({ organization: organizationId, user: req.user.id });
        if (!isAdmin && !isMember) return res.status(403).json({ message: "Access denied" });

        const boards = await Board.find({ organization: organizationId });
        return res.status(200).json({ message: "Boards list", boards });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

// ==================== TASKS ====================
app.post("/api/v1/tasks", authMiddleware, async (req, res) => {
    try {
        const { name, description, boardId, assignedId } = req.body;
        if (!name || !description || !boardId || !assignedId) return res.status(400).json({ message: "All fields required" });

        const board = await Board.findById(boardId);
        if (!board) return res.status(404).json({ message: "Board not found" });

        const organization = await Organization.findById(board.organization);
        if (!organization) return res.status(404).json({ message: "Organization not found" });

        // Only admin or member can create tasks
        const isAdmin = organization.admin.toString() === req.user.id;
        const isMember = await OrganizationMember.exists({ organization: organization._id, user: req.user.id });
        if (!isAdmin && !isMember) return res.status(403).json({ message: "Access denied" });

        const task = await Task.create({ title: name, description, board: boardId, assignedTo: assignedId });
        return res.status(201).json({ message: "Task created", task });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/v1/tasks/:boardId", authMiddleware, async (req, res) => {
    try {
        const { boardId } = req.params;
        const board = await Board.findById(boardId);
        if (!board) return res.status(404).json({ message: "Board not found" });

        const organization = await Organization.findById(board.organization);
        if (!organization) return res.status(404).json({ message: "Organization not found" });

        // Admin or member can view tasks
        const isAdmin = organization.admin.toString() === req.user.id;
        const isMember = await OrganizationMember.exists({ organization: organization._id, user: req.user.id });
        if (!isAdmin && !isMember) return res.status(403).json({ message: "Access denied" });

        const tasks = await Task.find({ board: boardId }).populate("assignedTo", "email name");
        return res.status(200).json({ message: "Tasks list", tasks });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});