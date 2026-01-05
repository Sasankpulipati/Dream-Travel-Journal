const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({
    year: { type: Number, required: true },
    title: { type: String, required: true },
    desc: String,
    userId: { type: String, required: true }
});

module.exports = mongoose.model('Timeline', timelineSchema);
