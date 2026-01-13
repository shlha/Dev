// Background service worker for LinkedIn Post Counter

class LinkedInBackgroundService {
  constructor() {
    this.debugMode = true; // Enable detailed logging
    this.init();
  }

  log(...args) {
    if (this.debugMode) {
      console.log('[LinkedIn Extension Background]', ...args);
    }
  }

  init() {
    this.log('Initializing background service...');
    this.setupInstallListener();
    this.setupMessageListener();
    this.setupTabUpdateListener();
    this.log('Background service initialized');
  }

  setupInstallListener() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.log('LinkedIn Post Counter extension installed');
        this.setDefaultSettings();
      } else if (details.reason === 'update') {
        this.log('LinkedIn Post Counter extension updated to version', chrome.runtime.getManifest().version);
      }
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.log('Received message:', request.action, 'from tab:', sender.tab?.id);

      switch (request.action) {
        case 'analyzeProfile':
          this.handleAnalyzeProfile(request, sender, sendResponse);
          return true; // Keep message channel open for async response

        case 'getStoredData':
          this.handleGetStoredData(sendResponse);
          return true;

        case 'storeAnalysisResult':
          this.handleStoreResult(request.data, sendResponse);
          return true;

        case 'checkContentScript':
          this.handleCheckContentScript(sender, sendResponse);
          return true;

        default:
          this.log('Unknown message action:', request.action);
      }
    });
  }

  setupTabUpdateListener() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Listen for LinkedIn profile page loads
      if (changeInfo.status === 'complete' &&
          tab.url &&
          this.isLinkedInProfileUrl(tab.url)) {

        this.log('LinkedIn profile page loaded:', tab.url);
        // Inject content script if needed
        this.ensureContentScriptInjected(tabId);
      }
    });
  }

  isLinkedInProfileUrl(url) {
    if (!url) return false;
    const isLinkedIn = url.includes('linkedin.com/in/') || url.includes('linkedin.com/profile/');
    this.log('URL check:', url, 'Is LinkedIn profile:', isLinkedIn);
    return isLinkedIn;
  }

  async ensureContentScriptInjected(tabId) {
    try {
      this.log('Ensuring content script is injected in tab:', tabId);
      
      // Check if content script is already injected
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: () => window.linkedInExtensionInjected === true
      });

      if (!results[0]?.result) {
        this.log('Content script not found, injecting...');
        
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        this.log('Content script injected into tab:', tabId);
      } else {
        this.log('Content script already injected in tab:', tabId);
      }
    } catch (error) {
      this.log('Failed to inject content script:', error);
      throw error;
    }
  }

  async handleAnalyzeProfile(request, sender, sendResponse) {
    try {
      const tabId = sender.tab?.id;
      if (!tabId) {
        throw new Error('No tab ID available');
      }

      this.log('Starting profile analysis for tab:', tabId);

      // Check rate limiting
      if (!LinkedInBackgroundService.rateLimiter.canMakeRequest()) {
        const waitTime = LinkedInBackgroundService.rateLimiter.getTimeUntilNextRequest();
        throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`);
      }

      // Ensure content script is loaded
      await this.ensureContentScriptInjected(tabId);
      
      // Wait a moment for injection to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try multiple analysis strategies
      let analysisResult = null;
      let lastError = null;

      // Strategy 1: Use content script message passing
      try {
        this.log('Trying content script message analysis...');
        
        const response = await this.sendMessageToTab(tabId, { action: 'analyzeProfile' });
        if (response && response.success && response.data) {
          analysisResult = response.data;
          this.log('Content script analysis successful:', analysisResult);
        } else {
          throw new Error('Content script returned no data or failed');
        }
      } catch (error) {
        this.log('Content script message analysis failed:', error);
        lastError = error;
      }

      // Strategy 2: Direct script injection
      if (!analysisResult || (analysisResult.profileName === 'Unknown' && analysisResult.postCount === 0)) {
        try {
          this.log('Trying direct script injection analysis...');
          
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: this.directAnalysisFunction
          });

          if (results && results[0] && results[0].result) {
            const directResult = results[0].result;
            
            // Use direct result if it's better than content script result
            if (!analysisResult || 
                directResult.profileName !== 'Unknown' || 
                directResult.postCount > analysisResult.postCount) {
              analysisResult = directResult;
              this.log('Direct injection analysis successful:', analysisResult);
            }
          }
        } catch (error) {
          this.log('Direct script injection failed:', error);
          lastError = error;
        }
      }

      // Strategy 3: Ultimate fallback
      if (!analysisResult || (analysisResult.profileName === 'Unknown' && analysisResult.postCount === 0)) {
        try {
          this.log('Trying ultimate fallback analysis...');
          
          const ultimateResults = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: this.ultimateFallbackFunction
          });

          if (ultimateResults && ultimateResults[0] && ultimateResults[0].result) {
            analysisResult = ultimateResults[0].result;
            this.log('Ultimate fallback analysis result:', analysisResult);
          }
        } catch (error) {
          this.log('Ultimate fallback analysis failed:', error);
          lastError = error;
        }
      }

      if (analysisResult && (analysisResult.profileName !== 'Unknown' || analysisResult.postCount > 0)) {
        // Store the result
        await this.storeAnalysisResult(analysisResult);
        this.log('Analysis completed successfully');
        sendResponse({ success: true, data: analysisResult });
      } else {
        const errorMessage = lastError ? lastError.message : 'All analysis methods failed to produce results';
        this.log('Analysis failed:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      this.log('Analysis error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Direct analysis function for script injection
  directAnalysisFunction() {
    console.log('[Direct Analysis] Starting direct analysis...');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        let postCount = 0;
        let profileName = 'Unknown';
        const foundPosts = [];
        const debugInfo = {
          method: 'direct-injection',
          url: window.location.href,
          title: document.title,
          timestamp: now.toISOString(),
          errors: []
        };

        try {
          console.log('[Direct Analysis] Current URL:', window.location.href);
          console.log('[Direct Analysis] Page title:', document.title);

          // Check if we're on a LinkedIn profile page
          if (!window.location.href.includes('linkedin.com/in/')) {
            throw new Error('Not on a LinkedIn profile page');
          }

          // Enhanced profile name extraction
          profileName = this.extractProfileNameDirect();
          console.log('[Direct Analysis] Profile name found:', profileName);

          // Enhanced post detection
          const posts = this.findRecentPostsDirect(twentyFourHoursAgo);
          postCount = posts.length;
          foundPosts.push(...posts);

          console.log('[Direct Analysis] Posts found:', postCount);

          // Fallback detection if no posts found
          if (postCount === 0) {
            console.log('[Direct Analysis] No posts found, trying fallback...');
            const fallbackCount = this.performFallbackDetectionDirect();
            if (fallbackCount > 0) {
              postCount = fallbackCount;
              foundPosts.push({
                text: 'Activity detected through fallback analysis',
                time: 'Estimated from page content',
                type: 'fallback-detection'
              });
              debugInfo.usedFallback = true;
            }
          }

        } catch (error) {
          console.error('[Direct Analysis] Error:', error);
          debugInfo.errors.push(error.message);
        }

        const result = {
          postCount,
          profileName,
          analyzedAt: now.toISOString(),
          url: window.location.href,
          posts: foundPosts.slice(0, 10),
          debug: debugInfo
        };

        console.log('[Direct Analysis] Final result:', result);
        resolve(result);
      }, 3000);
    });
  }

  extractProfileNameDirect() {
    console.log('[Direct Analysis] Extracting profile name...');
    
    // Comprehensive name selectors
    const nameSelectors = [
      'h1[data-anonymize="person-name"]',
      '.text-heading-xlarge',
      '.pv-text-details__left-panel h1',
      '.pv-text-details h1',
      '.pv-top-card h1',
      'main h1',
      '.scaffold-layout h1',
      '[data-view-name="profile-top-card"] h1',
      '.ph5 h1'
    ];

    for (const selector of nameSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`[Direct Analysis] Selector "${selector}" found ${elements.length} elements`);
        
        for (const element of elements) {
          if (element && element.textContent) {
            const name = element.textContent.trim();
            if (this.isValidNameDirect(name)) {
              console.log(`[Direct Analysis] Valid name found: ${name}`);
              return name;
            }
          }
        }
      } catch (e) {
        console.warn(`[Direct Analysis] Error with selector ${selector}:`, e);
      }
    }

    // Try title extraction
    const title = document.title;
    if (title) {
      const patterns = [
        title.split(' | LinkedIn')[0],
        title.split(' | ')[0],
        title.split(' - LinkedIn')[0],
        title.split(' - ')[0]
      ];
      
      for (const pattern of patterns) {
        const cleanName = pattern.trim();
        if (this.isValidNameDirect(cleanName)) {
          console.log(`[Direct Analysis] Name found in title: ${cleanName}`);
          return cleanName;
        }
      }
    }

    console.log('[Direct Analysis] No valid name found');
    return 'Unknown';
  }

  findRecentPostsDirect(cutoffTime) {
    console.log('[Direct Analysis] Finding recent posts...');
    
    const posts = [];
    const processedContent = new Set();
    
    const postSelectors = [
      '.pv-recent-activity-detail-v2',
      '.pvs-list__item',
      '.feed-shared-update-v2',
      '.update-components-text',
      '[data-view-name="profile-component-entity"]',
      '.artdeco-card',
      '.pv-entity__summary-info'
    ];

    let totalElements = 0;

    postSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        totalElements += elements.length;
        
        console.log(`[Direct Analysis] Selector "${selector}" found ${elements.length} elements`);

        elements.forEach(element => {
          try {
            const post = this.extractPostDirect(element, cutoffTime, processedContent);
            if (post) {
              posts.push(post);
              console.log(`[Direct Analysis] Found post: ${post.text.substring(0, 50)}...`);
            }
          } catch (e) {
            console.warn('[Direct Analysis] Error processing post element:', e);
          }
        });
      } catch (e) {
        console.warn(`[Direct Analysis] Error with selector "${selector}":`, e);
      }
    });

    console.log(`[Direct Analysis] Scanned ${totalElements} elements, found ${posts.length} posts`);
    return posts;
  }

  extractPostDirect(element, cutoffTime, processedContent) {
    try {
      const content = element.textContent.trim();
      const contentKey = content.substring(0, 100);

      if (processedContent.has(contentKey) || content.length < 15) {
        return null;
      }

      let isRecent = false;
      let timeFound = '';

      // Look for time elements
      const timeElement = element.querySelector('time[datetime]') || 
                         element.querySelector('[class*="time"]') ||
                         element.closest('.pvs-list__item')?.querySelector('time[datetime]');

      if (timeElement) {
        const datetime = timeElement.getAttribute('datetime');
        if (datetime) {
          const postDate = new Date(datetime);
          if (!isNaN(postDate.getTime()) && postDate >= cutoffTime) {
            isRecent = true;
            timeFound = datetime;
          }
        }
      }

      // Text-based time detection
      if (!isRecent) {
        const text = content.toLowerCase();
        const timePatterns = [
          /(\d+)\s*(?:minute|min)s?\s*ago/,
          /(\d+)\s*(?:hour|hr)s?\s*ago/,
          /(\d+)h\s*ago/,
          /(\d+)m\s*ago/,
          /yesterday/,
          /1\s*day\s*ago/
        ];

        for (const pattern of timePatterns) {
          const match = text.match(pattern);
          if (match) {
            const value = parseInt(match[1]) || 1;
            if (pattern.source.includes('hour') && value <= 24) {
              isRecent = true;
              timeFound = `Text: ${match[0]}`;
              break;
            } else if (pattern.source.includes('minute') && value <= 1440) {
              isRecent = true;
              timeFound = `Text: ${match[0]}`;
              break;
            } else if (pattern.source.includes('day') || pattern.source.includes('yesterday')) {
              isRecent = true;
              timeFound = `Text: ${match[0]}`;
              break;
            }
          }
        }
      }

      if (!isRecent) {
        return null;
      }

      processedContent.add(contentKey);

      return {
        text: content.substring(0, 150),
        time: timeFound,
        type: 'text'
      };
    } catch (error) {
      console.warn('[Direct Analysis] Error extracting post:', error);
      return null;
    }
  }

  performFallbackDetectionDirect() {
    console.log('[Direct Analysis] Performing fallback detection...');
    
    try {
      const pageText = document.body.textContent.toLowerCase();
      
      const timePatterns = [
        /(\d+)\s*hour?s?\s*ago/g,
        /(\d+)\s*minute?s?\s*ago/g,
        /yesterday/g,
        /1\s*day\s*ago/g
      ];

      let totalMatches = 0;
      timePatterns.forEach(pattern => {
        const matches = pageText.match(pattern);
        if (matches) {
          totalMatches += matches.length;
        }
      });

      const estimatedPosts = Math.min(Math.max(0, Math.floor(totalMatches / 3)), 8);
      console.log(`[Direct Analysis] Fallback found ${totalMatches} time indicators, estimated ${estimatedPosts} posts`);
      
      return estimatedPosts;
    } catch (e) {
      console.error('[Direct Analysis] Fallback error:', e);
      return 0;
    }
  }

  isValidNameDirect(name) {
    if (!name || typeof name !== 'string') return false;
    
    const cleanName = name.trim();
    return cleanName.length >= 2 && 
           cleanName.length <= 100 && 
           !cleanName.toLowerCase().includes('linkedin') &&
           !cleanName.toLowerCase().includes('profile') &&
           !/^\d+$/.test(cleanName) && 
           /[a-zA-Z]/.test(cleanName);
  }

  // Ultimate fallback function
  ultimateFallbackFunction() {
    console.log('[Ultimate Fallback] Starting ultimate fallback...');
    
    const now = new Date();
    let profileName = 'Unknown';
    let postCount = 0;

    try {
      // Basic name detection from any heading
      const headings = document.querySelectorAll('h1, h2, h3');
      for (const heading of headings) {
        if (heading && heading.textContent) {
          const text = heading.textContent.trim();
          if (text.length > 2 && text.length < 80 && 
              !text.toLowerCase().includes('linkedin') &&
              /^[a-zA-Z\s.-]+$/.test(text)) {
            profileName = text;
            break;
          }
        }
      }

      // Try document title as last resort
      if (profileName === 'Unknown') {
        const title = document.title;
        if (title && !title.toLowerCase().includes('linkedin')) {
          const titleName = title.split(/[|\-—–•]/)[0].trim();
          if (titleName.length > 2 && titleName.length < 60) {
            profileName = titleName;
          }
        }
      }

      // Basic activity detection
      const bodyText = document.body.textContent.toLowerCase();
      const activityWords = ['ago', 'hour', 'minute', 'yesterday', 'posted', 'shared'];
      let activityCount = 0;
      
      activityWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        const matches = bodyText.match(regex);
        if (matches) {
          activityCount += matches.length;
        }
      });

      // Very conservative estimate
      if (activityCount > 15) {
        postCount = Math.min(Math.floor(activityCount / 20), 5);
      }

      console.log('[Ultimate Fallback] Results:', { profileName, postCount, activityCount });

    } catch (error) {
      console.error('[Ultimate Fallback] Error:', error);
    }

    return {
      postCount,
      profileName,
      analyzedAt: now.toISOString(),
      url: window.location.href,
      method: 'ultimate-fallback',
      debug: {
        method: 'ultimate-fallback',
        wasLastResort: true
      }
    };
  }

  async handleCheckContentScript(sender, sendResponse) {
    try {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ success: false, error: 'No tab ID' });
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: () => window.linkedInExtensionInjected === true
      });

      const isInjected = results[0]?.result || false;
      this.log('Content script check for tab', tabId, ':', isInjected);
      
      sendResponse({ success: true, injected: isInjected });
    } catch (error) {
      this.log('Error checking content script:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetStoredData(sendResponse) {
    try {
      const result = await chrome.storage.local.get(['lastAnalysis', 'settings']);
      this.log('Retrieved stored data:', result);
      sendResponse({ success: true, data: result });
    } catch (error) {
      this.log('Failed to get stored data:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleStoreResult(data, sendResponse) {
    try {
      await this.storeAnalysisResult(data);
      sendResponse({ success: true });
    } catch (error) {
      this.log('Failed to store result:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async storeAnalysisResult(data) {
    try {
      const storageData = {
        lastAnalysis: {
          ...data,
          timestamp: Date.now()
        }
      };

      await chrome.storage.local.set(storageData);
      this.log('Analysis result stored successfully');

      // Keep analysis history
      const history = await chrome.storage.local.get('analysisHistory') || { analysisHistory: [] };
      history.analysisHistory = history.analysisHistory || [];
      history.analysisHistory.unshift(data);

      if (history.analysisHistory.length > 10) {
        history.analysisHistory = history.analysisHistory.slice(0, 10);
      }

      await chrome.storage.local.set({ analysisHistory: history.analysisHistory });
      this.log('Analysis history updated');

    } catch (error) {
      this.log('Failed to store analysis result:', error);
      throw error;
    }
  }

  async setDefaultSettings() {
    try {
      const defaultSettings = {
        autoAnalyze: false,
        showNotifications: true,
        maxStoredResults: 10,
        debugMode: false
      };

      await chrome.storage.local.set({ settings: defaultSettings });
      this.log('Default settings set');
    } catch (error) {
      this.log('Failed to set default settings:', error);
    }
  }

  // Enhanced rate limiting
  static rateLimiter = {
    requests: [],
    maxRequests: 20, // Increased limit
    timeWindow: 60000, // 1 minute

    canMakeRequest() {
      const now = Date.now();
      // Remove old requests outside the time window
      this.requests = this.requests.filter(time => now - time < this.timeWindow);

      if (this.requests.length < this.maxRequests) {
        this.requests.push(now);
        return true;
      }
      return false;
    },

    getTimeUntilNextRequest() {
      if (this.requests.length < this.maxRequests) return 0;
      
      const oldestRequest = Math.min(...this.requests);
      const timeUntilExpiry = this.timeWindow - (Date.now() - oldestRequest);
      return Math.max(0, timeUntilExpiry);
    },

    getRemainingRequests() {
      const now = Date.now();
      this.requests = this.requests.filter(time => now - time < this.timeWindow);
      return this.maxRequests - this.requests.length;
    }
  };
}

// Initialize background service with error handling
try {
  new LinkedInBackgroundService();
} catch (error) {
  console.error('Failed to initialize LinkedIn background service:', error);
}