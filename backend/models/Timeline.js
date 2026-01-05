const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({
    year: { type: Number, required: true },
    title: { type: String, required: true },
    desc: String
});

module.exports = mongoose.model('Timeline', timelineSchema);
