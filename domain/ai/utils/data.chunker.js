// src/modules/ai/utils/data.chunker.js

class DataChunker {
  /**
   * Chunk array into smaller arrays
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Chunk object for streaming
   */
  chunkObject(obj, maxProperties = 10) {
    const entries = Object.entries(obj);
    const chunks = [];
    
    for (let i = 0; i < entries.length; i += maxProperties) {
      const chunk = Object.fromEntries(entries.slice(i, i + maxProperties));
      chunks.push(chunk);
    }
    
    return chunks;
  }
  
  /**
   * Chunk markdown for streaming
   */
  chunkMarkdown(markdown, chunkSize = 100) {
    const chunks = [];
    let remaining = markdown;
    
    while (remaining.length > 0) {
      let chunk = remaining.slice(0, chunkSize);
      
      // Try to break at a sentence or newline
      const lastPeriod = chunk.lastIndexOf('. ');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > chunkSize / 2) {
        chunk = remaining.slice(0, breakPoint + 1);
        remaining = remaining.slice(breakPoint + 1);
      } else {
        remaining = remaining.slice(chunkSize);
      }
      
      chunks.push(chunk);
    }
    
    return chunks;
  }
  
  /**
   * Stream large dataset in batches
   */
  async *streamData(data, batchSize = 100) {
    for (let i = 0; i < data.length; i += batchSize) {
      yield data.slice(i, i + batchSize);
    }
  }
  
  /**
   * Prepare data for export with pagination
   */
  prepareExport(data, options = {}) {
    const {
      page = 1,
      pageSize = 1000,
      maxTotal = 50000,
    } = options;
    
    const total = Math.min(data.length, maxTotal);
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      data: data.slice(start, end),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
  
  /**
   * Create a readable stream from data
   */
  createReadableStream(data, options = {}) {
    const { chunkSize = 100, interval = 0 } = options;
    const chunks = this.chunkArray(data, chunkSize);
    let index = 0;
    
    return new ReadableStream({
      async pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        
        if (interval > 0) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        controller.enqueue(chunks[index]);
        index++;
      },
    });
  }
  
  /**
   * Split by token count (approximate for LLM context)
   */
  splitByTokens(text, maxTokens = 2000) {
    // Approximate token count (4 chars ≈ 1 token)
    const approxTokens = text.length / 4;
    
    if (approxTokens <= maxTokens) {
      return [text];
    }
    
    const chunks = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      const targetLength = maxTokens * 4;
      let chunk = remaining.slice(0, targetLength);
      
      // Try to break at paragraph or sentence
      const lastParagraph = chunk.lastIndexOf('\n\n');
      const lastSentence = chunk.lastIndexOf('. ');
      
      const breakPoint = Math.max(lastParagraph, lastSentence);
      
      if (breakPoint > targetLength / 2) {
        chunk = remaining.slice(0, breakPoint + 1);
        remaining = remaining.slice(breakPoint + 1);
      } else {
        remaining = remaining.slice(targetLength);
      }
      
      chunks.push(chunk);
    }
    
    return chunks;
  }
  
  /**
   * Merge chunks back together
   */
  mergeChunks(chunks) {
    return chunks.join('');
  }
  
  /**
   * Progressive data loader with caching
   */
  createProgressiveLoader(data, options = {}) {
    const { chunkSize = 100, cacheSize = 1000 } = options;
    const cache = new Map();
    let loadedIndex = 0;
    
    return {
      load: (start, end) => {
        const result = [];
        
        for (let i = start; i < end && i < data.length; i++) {
          if (cache.has(i)) {
            result.push(cache.get(i));
          } else {
            result.push(data[i]);
            if (cache.size < cacheSize) {
              cache.set(i, data[i]);
            }
          }
        }
        
        loadedIndex = Math.max(loadedIndex, end);
        return result;
      },
      
      loadNext: () => {
        const start = loadedIndex;
        const end = Math.min(loadedIndex + chunkSize, data.length);
        return this.load(start, end);
      },
      
      getProgress: () => ({
        loaded: loadedIndex,
        total: data.length,
        percentage: (loadedIndex / data.length) * 100,
      }),
      
      reset: () => {
        loadedIndex = 0;
        cache.clear();
      },
    };
  }
  
  /**
   * Estimate data size in bytes
   */
  estimateSize(data) {
    const sample = JSON.stringify(data[0] || {});
    const avgSize = sample.length;
    return avgSize * data.length;
  }
  
  /**
   * Check if data needs chunking
   */
  needsChunking(data, maxSize = 1024 * 1024) { // 1MB
    return this.estimateSize(data) > maxSize;
  }
}

export default new DataChunker();