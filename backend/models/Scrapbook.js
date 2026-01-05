const mongoose = require('mongoose');

const scrapbookSchema = new mongoose.Schema({
    destination: { type: String, required: true },
    lat: Number,
    lng: Number,
    img: String,
    desc: String,
    gallery: [String]
});

module.exports = mongoose.model('Scrapbook', scrapbookSchema);
