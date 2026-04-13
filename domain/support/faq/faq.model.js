import mongoose from "mongoose";

const faqSchema = new mongoose.Schema({
    faq_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    category: {
        type: String,
        required: true,
        index: true,
        enum: ['academic', 'technical', 'billing', 'registration', 'general'],
        default: 'general'
    },
    question: {
        type: String,
        required: true,
        trim: true
    },
    answer: {
        type: String,
        required: true
    },
    keywords: [{
        type: String,
        index: true
    }],
    tags: [{
        type: String,
        index: true
    }],
    is_active: {
        type: Boolean,
        default: true,
        index: true
    },
    is_featured: {
        type: Boolean,
        default: false,
        index: true
    },
    view_count: {
        type: Number,
        default: 0
    },
    helpful_count: {
        type: Number,
        default: 0
    },
    not_helpful_count: {
        type: Number,
        default: 0
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    last_updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    last_updated_at: {
        type: Date,
        default: Date.now
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

// Indexes for better search performance
faqSchema.index({ question: 'text', answer: 'text', keywords: 'text' });
faqSchema.index({ category: 1, is_active: 1 });
faqSchema.index({ is_featured: 1, is_active: 1 });
faqSchema.index({ view_count: -1 });
faqSchema.index({ helpful_count: -1 });

const FAQ = mongoose.model('FAQ', faqSchema);
export default FAQ;