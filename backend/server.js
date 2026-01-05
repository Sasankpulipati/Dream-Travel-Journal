const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');

// Models
const User = require('./models/User');
const Timeline = require('./models/Timeline');
const Scrapbook = require('./models/Scrapbook');
const BucketList = require('./models/BucketList');
const Message = require('./models/Message');

const app = express();
const PORT = 3000;

// Connect to MongoDB
const mongoUri = 'mongodb://127.0.0.1:27017/dream_travel_journal';

mongoose.connect(mongoUri)
    .then(() => console.log('✅ Connected to MongoDB at', mongoUri))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

mongoose.connection.on('error', err => {
    console.error('❌ MongoDB Runtime Error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB Disconnected');
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(cors());
app.use(bodyParser.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Frontend Files from ../frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Routes ---

// GET all data (Aggregated for initial load to match old API structure)
app.get('/api/data', async (req, res) => {
    console.log('📥 GET /api/data request received');
    try {
        console.log('🔍 Querying Timeline...');
        const timeline = await Timeline.find().sort({ year: -1 });
        console.log('✅ Timeline fetched:', timeline.length);

        const [scrapbook, bucketList, messages, users] = await Promise.all([
            Scrapbook.find(),
            BucketList.find(),
            Message.find(),
            User.find()
        ]);
        console.log('✅ All data fetched');

        res.json({
            timeline,
            scrapbook,
            bucketList,
            messages,
            users
        });
    } catch (err) {
        console.error('❌ GET /api/data Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST Timeline
app.post('/api/timeline', async (req, res) => {
    try {
        const newItem = new Timeline(req.body);
        await newItem.save();
        res.json({ success: true, item: newItem });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Scrapbook
app.post('/api/scrapbook', async (req, res) => {
    try {
        const newItem = new Scrapbook(req.body);
        await newItem.save();
        res.json({ success: true, item: newItem });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Scrapbook (Update)
app.put('/api/scrapbook/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedItem = await Scrapbook.findByIdAndUpdate(id, req.body, { new: true });
        if (updatedItem) {
            res.json({ success: true, item: updatedItem });
        } else {
            res.status(404).json({ error: "Item not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Scrapbook
app.delete('/api/scrapbook/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Scrapbook.findByIdAndDelete(id);
        if (result) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Item not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Bucket List
app.post('/api/bucketlist', async (req, res) => {
    try {
        const newItem = new BucketList(req.body);
        await newItem.save();
        res.json({ success: true, item: newItem });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Bucket List (Toggle check)
app.put('/api/bucketlist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { checked } = req.body;
        // The frontend sends the MongoDB _id (or needs to)
        // If frontend sends custom 'id' string, we might have issues.
        // The old code generated string IDs (Date.now()). Mongoose uses ObjectId as _id.
        // We need to ensure frontend handles _id.

        const item = await BucketList.findByIdAndUpdate(id, { checked }, { new: true });
        if (item) {
            res.json({ success: true, item });
        } else {
            res.status(404).json({ error: "Item not found" });
        }
    } catch (err) {
        // If id is not a valid ObjectId, it throws
        res.status(500).json({ error: err.message });
    }
});

// DELETE Bucket List
app.delete('/api/bucketlist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await BucketList.findByIdAndDelete(id);
        if (result) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Item not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Contact Route ---
app.post('/api/contact', async (req, res) => {
    try {
        const newItem = new Message(req.body);
        await newItem.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
    }
    try {
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).json({ error: "Username already exists" });
        }
        const newUser = new User({ username, password });
        await newUser.save();
        res.json({ success: true, user: { id: newUser._id, username: newUser.username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username, password });
        if (user) {
            res.json({ success: true, user: { id: user._id, username: user.username } });
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
