// Place this in: services/support/faq.service.js

import crypto from "crypto";
import mongoose from "mongoose";
import FAQ from "./faq.model.js";
import AppError from "../../errors/AppError.js";

class FAQService {
    constructor() {
        this.CACHE_TTL = 3600000; // 1 hour cache
        this.cache = new Map();
        
        // Start cache cleanup interval
        this.startCacheCleanup();
    }

    /**
     * Start cache cleanup interval
     */
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp > this.CACHE_TTL) {
                    this.cache.delete(key);
                }
            }
        }, 300000); // Clean every 5 minutes
    }

    /**
     * Generate unique FAQ ID
     */
    generateFaqId() {
        return `faq_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }

    /**
     * Get cached data
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    /**
     * Set cached data
     */
    setCached(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     */
    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    /**
     * Create a new FAQ
     */
    async createFAQ(faqData) {
        try {
            
            const faq = new FAQ({
                category: faqData.category,
                question: faqData.question,
                answer: faqData.answer,
                // keywords: this.extractKeywords(faqData.question + ' ' + (faqData.keywords || '')),
                tags: faqData.tags || [],
                is_active: faqData.is_active !== false,
                is_featured: faqData.is_featured || false,
                view_count: 0,
                helpful_count: 0,
                not_helpful_count: 0,
                created_by: faqData.created_by,
                last_updated_by: faqData.created_by,
                metadata: faqData.metadata || {}
            });
            
            await faq.save();
            
            // Clear FAQs cache
            this.clearCache('faqs');
            
            return faq;
        } catch (error) {
            throw new AppError(`Failed to create FAQ: ${error.message}`);
        }
    }

    /**
     * Get FAQs by category
     */
    async getFAQsByCategory(category, options = {}) {
        try {
            const cacheKey = `faqs_category_${category}_${JSON.stringify(options)}`;
            const cached = this.getCached(cacheKey);
            if (cached) return cached;
            
            const query = {
                category: category,
                is_active: options.includeInactive ? undefined : true
            };
            
            let faqsQuery = FAQ.find(query);
            
            // Apply sorting
            if (options.sortBy === 'views') {
                faqsQuery = faqsQuery.sort({ view_count: -1 });
            } else if (options.sortBy === 'helpful') {
                faqsQuery = faqsQuery.sort({ helpful_count: -1 });
            } else if (options.sortBy === 'featured') {
                faqsQuery = faqsQuery.sort({ is_featured: -1, created_at: -1 });
            } else {
                faqsQuery = faqsQuery.sort({ created_at: -1 });
            }
            
            // Apply limit
            if (options.limit) {
                faqsQuery = faqsQuery.limit(options.limit);
            }
            
            const faqs = await faqsQuery
                .populate('created_by', 'first_name last_name email')
                .populate('last_updated_by', 'first_name last_name email');
            
            const result = {
                category: category,
                faqs: faqs,
                total: faqs.length
            };
            
            this.setCached(cacheKey, result);
            return result;
        } catch (error) {
            throw new AppError(`Failed to get FAQs by category: ${error.message}`);
        }
    }

    /**
     * Search FAQs
     */
    async searchFAQs(query, filters = {}, page = 1, limit = 20) {
        try {
            const cacheKey = `faqs_search_${query}_${JSON.stringify(filters)}_${page}_${limit}`;
            const cached = this.getCached(cacheKey);
            if (cached) return cached;
            
            const searchQuery = {};
            
            // Text search
            if (query && query.trim()) {
                searchQuery.$or = [
                    { question: { $regex: query, $options: 'i' } },
                    { answer: { $regex: query, $options: 'i' } },
                    { keywords: { $regex: query, $options: 'i' } },
                    { tags: { $in: [new RegExp(query, 'i')] } }
                ];
            }
            
            // Apply filters
            if (filters.category) {
                searchQuery.category = filters.category;
            }
            
            if (filters.is_active !== undefined) {
                searchQuery.is_active = filters.is_active;
            } else {
                searchQuery.is_active = true; // Default to active only
            }
            
            if (filters.is_featured !== undefined) {
                searchQuery.is_featured = filters.is_featured;
            }
            
            if (filters.tags && filters.tags.length > 0) {
                searchQuery.tags = { $in: filters.tags };
            }
            
            // Execute search with pagination
            const skip = (page - 1) * limit;
            
            const [faqs, total] = await Promise.all([
                FAQ.find(searchQuery)
                    .populate('created_by', 'first_name last_name email')
                    .populate('last_updated_by', 'first_name last_name email')
                    .sort({ is_featured: -1, view_count: -1, created_at: -1 })
                    .skip(skip)
                    .limit(limit),
                FAQ.countDocuments(searchQuery)
            ]);
            
            const result = {
                faqs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                query: query
            };
            
            this.setCached(cacheKey, result);
            return result;
        } catch (error) {
            throw new AppError(`Failed to search FAQs: ${error.message}`);
        }
    }

    /**
     * Get FAQ by ID
     */
    async getFAQ(faqId, incrementView = false) {
        try {
            const faq = await FAQ.findOne({ _id: faqId })
                .populate('created_by', 'first_name last_name email')
                .populate('last_updated_by', 'first_name last_name email');
            
            if (!faq) {
                throw new AppError('FAQ not found', 404);
            }
            
            // Increment view count if requested
            if (incrementView) {
                faq.view_count += 1;
                await faq.save();
            }
            
            return faq;
        } catch (error) {
            throw new AppError(`Failed to get FAQ: ${error.message}`);
        }
    }

    /**
     * Update FAQ
     */
    async updateFAQ(faqId, updateData, userId) {
        try {
            if (updateData.question) {
                updateData.keywords = this.extractKeywords(
                    updateData.question + ' ' + (updateData.keywords || '')
                );
            }
            
            updateData.last_updated_by = userId;
            updateData.last_updated_at = new Date();
            
            const faq = await FAQ.findOneAndUpdate(
                { _id: faqId },
                { $set: updateData },
                { new: true }
            );
            
            if (!faq) {
                throw new AppError('FAQ not found', 404);
            }
            
            // Clear FAQs cache
            this.clearCache('faqs');
            
            return faq;
        } catch (error) {
            throw new AppError(`Failed to update FAQ: ${error.message}`);
        }
    }

    /**
     * Delete FAQ
     */
    async deleteFAQ(faqId) {
        try {
            const faq = await FAQ.findOneAndDelete({ _id: faqId });
            
            if (!faq) {
                throw new AppError('FAQ not found', 404);
            }
            
            // Clear FAQs cache
            this.clearCache('faqs');
            
            return true;
        } catch (error) {
            throw new AppError(`Failed to delete FAQ: ${error.message}`);
        }
    }

    /**
     * Mark FAQ as helpful or not helpful
     */
    async markHelpful(faqId, isHelpful, userId = null) {
        try {
            const faq = await FAQ.findOne({ _id: faqId });
            
            if (!faq) {
                throw new AppError('FAQ not found', 404);
            }
            
            if (isHelpful) {
                faq.helpful_count += 1;
            } else {
                faq.not_helpful_count += 1;
            }
            
            await faq.save();
            
            return {
                helpful_count: faq.helpful_count,
                not_helpful_count: faq.not_helpful_count,
                helpfulness_score: this.calculateHelpfulnessScore(faq.helpful_count, faq.not_helpful_count)
            };
        } catch (error) {
            throw new AppError(`Failed to mark helpful: ${error.message}`);
        }
    }

    /**
     * Get all available categories
     */
    async getAllCategories() {
        try {
            const cacheKey = 'faqs_categories';
            const cached = this.getCached(cacheKey);
            if (cached) return cached;
            
            const categories = await FAQ.aggregate([
                { $match: { is_active: true } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        faqs: { $push: '$$ROOT' }
                    }
                },
                {
                    $project: {
                        category: '$_id',
                        count: 1,
                        faqs: { $slice: ['$faqs', 5] } // Only return 5 sample FAQs per category
                    }
                },
                { $sort: { category: 1 } }
            ]);
            
            this.setCached(cacheKey, categories);
            return categories;
        } catch (error) {
            throw new AppError(`Failed to get categories: ${error.message}`);
        }
    }

    /**
     * Get popular FAQs
     */
    async getPopularFAQs(limit = 10, category = null) {
        try {
            const cacheKey = `faqs_popular_${limit}_${category}`;
            const cached = this.getCached(cacheKey);
            if (cached) return cached;
            
            const query = { is_active: true };
            if (category) {
                query.category = category;
            }
            
            const faqs = await FAQ.find(query)
                .sort({ view_count: -1, helpful_count: -1 })
                .limit(limit)
                .populate('created_by', 'first_name last_name email');
            
            this.setCached(cacheKey, faqs);
            return faqs;
        } catch (error) {
            throw new AppError(`Failed to get popular FAQs: ${error.message}`);
        }
    }

    /**
     * Get featured FAQs
     */
    async getFeaturedFAQs(limit = 5) {
        try {
            const cacheKey = `faqs_featured_${limit}`;
            const cached = this.getCached(cacheKey);
            if (cached) return cached;
            
            const faqs = await FAQ.find({ is_active: true, is_featured: true })
                .sort({ view_count: -1 })
                .limit(limit)
                .populate('created_by', 'first_name last_name email');
            
            this.setCached(cacheKey, faqs);
            return faqs;
        } catch (error) {
            throw new AppError(`Failed to get featured FAQs: ${error.message}`);
        }
    }

    /**
     * Get related FAQs based on keywords/tags
     */
    async getRelatedFAQs(faqId, limit = 5) {
        try {
            const faq = await this.getFAQ(faqId);
            
            if (!faq) {
                return [];
            }
            
            // Find FAQs with similar keywords or tags
            const related = await FAQ.find({
                _id: { $ne: faq._id },
                is_active: true,
                $or: [
                    { keywords: { $in: faq.keywords.slice(0, 5) } },
                    { tags: { $in: faq.tags } },
                    { category: faq.category }
                ]
            })
            .sort({ view_count: -1, helpful_count: -1 })
            .limit(limit)
            .populate('created_by', 'first_name last_name email');
            
            return related;
        } catch (error) {
            throw new AppError(`Failed to get related FAQs: ${error.message}`);
        }
    }

    /**
     * Get FAQ statistics
     */
    async getFAQStats() {
        try {
            const stats = await FAQ.aggregate([
                {
                    $group: {
                        _id: null,
                        total_faqs: { $sum: 1 },
                        total_views: { $sum: '$view_count' },
                        total_helpful: { $sum: '$helpful_count' },
                        total_not_helpful: { $sum: '$not_helpful_count' },
                        avg_helpfulness: {
                            $avg: {
                                $cond: [
                                    { $eq: [{ $add: ['$helpful_count', '$not_helpful_count'] }, 0] },
                                    0,
                                    {
                                        $multiply: [
                                            { $divide: ['$helpful_count', { $add: ['$helpful_count', '$not_helpful_count'] }] },
                                            100
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            ]);
            
            const categoryStats = await FAQ.aggregate([
                { $match: { is_active: true } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        total_views: { $sum: '$view_count' },
                        total_helpful: { $sum: '$helpful_count' }
                    }
                },
                { $sort: { count: -1 } }
            ]);
            
            return {
                total: stats[0] || { total_faqs: 0, total_views: 0, total_helpful: 0, total_not_helpful: 0, avg_helpfulness: 0 },
                by_category: categoryStats
            };
        } catch (error) {
            throw new AppError(`Failed to get FAQ stats: ${error.message}`);
        }
    }

    /**
     * Extract keywords from text
     */
    extractKeywords(text) {
        // Remove special characters and convert to lowercase
        const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
        
        // Split into words
        const words = cleanText.split(/\s+/);
        
        // Remove stop words
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'but', 'not', 'so', 'very', 'just', 'too']);
        
        const keywords = words.filter(word => 
            word.length > 2 && !stopWords.has(word)
        );
        
        // Remove duplicates and limit to 20 keywords
        return [...new Set(keywords)].slice(0, 20);
    }

    /**
     * Calculate helpfulness score
     */
    calculateHelpfulnessScore(helpful, notHelpful) {
        const total = helpful + notHelpful;
        if (total === 0) return 0;
        return Math.round((helpful / total) * 100);
    }

    /**
     * Bulk import FAQs
     */
    async bulkImportFAQs(faqs, userId) {
        try {
            const results = {
                success: [],
                failed: []
            };
            
            for (const faqData of faqs) {
                try {
                    const faq = await this.createFAQ({
                        ...faqData,
                        created_by: userId
                    });
                    results.success.push(faq);
                } catch (error) {
                    results.failed.push({
                        data: faqData,
                        error: error.message
                    });
                }
            }
            
            return results;
        } catch (error) {
            throw new AppError(`Failed to bulk import FAQs: ${error.message}`);
        }
    }

    /**
     * Export FAQs to JSON
     */
    async exportFAQs(filters = {}) {
        try {
            const query = {};
            
            if (filters.category) {
                query.category = filters.category;
            }
            
            if (filters.is_active !== undefined) {
                query.is_active = filters.is_active;
            }
            
            const faqs = await FAQ.find(query)
                .lean();
            
            return faqs;
        } catch (error) {
            throw new AppError(`Failed to export FAQs: ${error.message}`);
        }
    }
}

// Export singleton instance
const faqService = new FAQService();
export default faqService;