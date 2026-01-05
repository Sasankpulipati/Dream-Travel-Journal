const mongoose = require('mongoose');

const bucketListSchema = new mongoose.Schema({
    text: { type: String, required: true },
    checked: { type: Boolean, default: false },
    userId: { type: String, required: true }
});

module.exports = mongoose.model('BucketList', bucketListSchema);
