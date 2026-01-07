const mongoose = require('mongoose');

const bucketListSchema = new mongoose.Schema({
    text: { type: String, required: true },
    checked: { type: Boolean, default: false },
    planDetails: { type: String }, // Stores the HTML of the generated trip plan
    userId: { type: String, required: true }
});

module.exports = mongoose.model('BucketList', bucketListSchema);
