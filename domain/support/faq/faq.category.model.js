import mongoose from "mongoose";

const faqCategorySchema = new mongoose.Schema({
    category_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    icon: {
        type: String,
        default: '📚'
    },
    order: {
        type: Number,
        default: 0,
        index: true
    },
    is_active: {
        type: Boolean,
        default: true,
        index: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

const FAQCategory = mongoose.model('FAQCategory', faqCategorySchema);
export default FAQCategory;