// Popup script for LinkedIn Post Counter extension
class LinkedInPopup {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadStoredData();
  }

  bindEvents() {
    document.getElementById('analyzeBtn').addEventListener('click', () => {
      this.analyzeProfile();
    });

    document.getElementById('getCurrentBtn').addEventListener('click', () => {
      this.useCurrentTab();
    });

    // Auto-analyze if URL is pasted
    document.getElementById('profileUrl').addEventListener('paste', () => {
      setTimeout(() => this.validateUrl(), 100);
    });
  }

  async useCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('linkedin.com')) {
        this.showError('Please navigate to a LinkedIn profile page first');
        return;
      }

      document.getElementById('profileUrl').value = tab.url;
      this.analyzeProfile();
    } catch (error) {
      this.showError('Could not access current tab: ' + error.message);
    }
  }

  validateUrl() {
    const url = document.getElementById('profileUrl').value;
    const linkedInPattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?.*$/;
    return linkedInPattern.test(url);
  }

  async analyzeProfile() {
    const url = document.getElementById('profileUrl').value.trim();

    if (!url) {
      this.showError('Please enter a LinkedIn profile URL');
      return;
    }

    if (!this.validateUrl()) {
      this.showError('Please enter a valid LinkedIn profile URL (e.g., https://www.linkedin.com/in/username)');
      return;
    }

    this.showLoading();

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Navigate to the profile URL if not already there
      const profileUsername = this.extractUsernameFromUrl(url);
      const currentUsername = this.extractUsernameFromUrl(tab.url);

      if (profileUsername !== currentUsername) {
        console.log('Navigating to profile:', url);
        await chrome.tabs.update(tab.id, { url: url });
        // Wait for navigation to complete
        await this.waitForNavigation(tab.id);
      }

      // Wait additional time for LinkedIn's dynamic content
      console.log('Waiting for LinkedIn content to load...');
      await this.waitForLinkedInLoad(tab.id);

      // Execute comprehensive analysis with multiple fallback strategies
      console.log('Starting analysis...');
      let analysisResult = null;
      let lastError = null;

      // Strategy 1: Enhanced analysis
      try {
        console.log('Trying enhanced analysis...');
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: this.enhancedAnalysisFunction
        });

        if (results && results[0] && results[0].result) {
          analysisResult = results[0].result;
          console.log('Enhanced analysis result:', analysisResult);
        }
      } catch (error) {
        console.warn('Enhanced analysis failed:', error);
        lastError = error;
      }

      // Strategy 2: Content script analysis if enhanced failed
      if (!analysisResult || (analysisResult.profileName === 'Unknown' && analysisResult.postCount === 0)) {
        try {
          console.log('Trying content script analysis...');
          
          // First ensure content script is injected
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });

          // Wait a moment for injection
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Send message to content script
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'analyzeProfile' });
          
          if (response && response.success && response.data) {
            analysisResult = response.data;
            console.log('Content script analysis result:', analysisResult);
          }
        } catch (error) {
          console.warn('Content script analysis failed:', error);
          lastError = error;
        }
      }

      // Strategy 3: Ultimate fallback
      if (!analysisResult || (analysisResult.profileName === 'Unknown' && analysisResult.postCount === 0)) {
        try {
          console.log('Trying ultimate fallback analysis...');
          const fallbackResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: this.ultimateFallbackAnalysis
          });

          if (fallbackResults && fallbackResults[0] && fallbackResults[0].result) {
            analysisResult = fallbackResults[0].result;
            console.log('Ultimate fallback result:', analysisResult);
          }
        } catch (error) {
          console.warn('Ultimate fallback failed:', error);
          lastError = error;
        }
      }

      // Show results or error
      if (analysisResult && (analysisResult.profileName !== 'Unknown' || analysisResult.postCount > 0)) {
        this.showSuccess(analysisResult);
        this.storeResult(url, analysisResult);
      } else {
        console.error('All analysis strategies failed. Last error:', lastError);
        this.showError(`Analysis failed: ${lastError ? lastError.message : 'Unknown error'}. The profile may be private, restricted, or the page structure has changed. Try refreshing the page and ensure you can see the profile content.`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      this.showError('Failed to analyze profile: ' + error.message);
    }
  }

  extractUsernameFromUrl(url) {
    if (!url) return '';
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
    return match ? match[1] : '';
  }

  waitForNavigation(tabId) {
    return new Promise((resolve) => {
      const listener = (tabIdChanged, changeInfo, tab) => {
        if (tabIdChanged === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Give extra time for LinkedIn's dynamic content to load
          setTimeout(resolve, 8000); // Increased wait time
        }
      };
      chrome.tabs.onUpdated.addListener(listener);

      // Fallback timeout
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 30000); // Increased timeout
    });
  }

  async waitForLinkedInLoad(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: () => {
          return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // Increased attempts
            
            const checkForContent = () => {
              attempts++;
              console.log(`Content check attempt ${attempts}/${maxAttempts}`);
              
              // Enhanced content indicators
              const indicators = [
                () => document.querySelector('main'),
                () => document.querySelector('.scaffold-layout'),
                () => document.querySelector('[data-view-name*="profile"]'),
                () => document.querySelector('.pv-text-details'),
                () => document.querySelector('.ph5'),
                () => document.querySelector('h1') && document.querySelector('h1').textContent.trim().length > 0,
                () => document.body.textContent.includes('LinkedIn'),
                () => document.querySelector('.pv-top-card'),
                () => document.querySelector('.artdeco-card'),
                () => document.readyState === 'complete'
              ];

              const hasContent = indicators.some(check => {
                try { 
                  return check(); 
                } catch(e) { 
                  return false; 
                }
              });
              
              if (hasContent || attempts >= maxAttempts) {
                console.log(`Content loaded after ${attempts} attempts`);
                resolve(true);
              } else {
                setTimeout(checkForContent, 300); // Faster checking
              }
            };
            
            checkForContent();
          });
        }
      });
    } catch (e) {
      console.warn('Error waiting for LinkedIn load:', e);
    }
  }

  // Enhanced main analysis function with better error handling
  enhancedAnalysisFunction() {
    console.log('Starting enhanced analysis function...');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        let postCount = 0;
        let profileName = 'Unknown';
        const foundPosts = [];
        const debugInfo = {
          url: window.location.href,
          title: document.title,
          timestamp: now.toISOString(),
          selectorsAttempted: [],
          elementsFound: 0,
          errors: []
        };

        try {
          console.log('Page URL:', window.location.href);
          console.log('Page title:', document.title);

          // Check if we're actually on a LinkedIn profile page
          if (!window.location.href.includes('linkedin.com/in/')) {
            throw new Error('Not on a LinkedIn profile page');
          }

          // Enhanced profile name extraction
          profileName = this.extractProfileNameComprehensive();
          console.log('Profile name found:', profileName);

          // Enhanced post detection with multiple strategies
          const posts = this.findAllRecentPostsComprehensive(twentyFourHoursAgo, debugInfo);
          postCount = posts.length;
          foundPosts.push(...posts);

          console.log('Posts found:', postCount);

          // Enhanced fallback detection if no posts found
          if (postCount === 0) {
            console.log('No posts found, trying enhanced fallback...');
            const fallbackCount = this.performSuperEnhancedFallback();
            if (fallbackCount > 0) {
              postCount = fallbackCount;
              foundPosts.push({
                text: 'Activity detected through enhanced text analysis',
                time: 'Estimated from page content',
                type: 'fallback-detection'
              });
              debugInfo.usedFallback = true;
            }
          }

        } catch (error) {
          console.error('Error in enhanced analysis:', error);
          debugInfo.errors.push(error.message);
        }

        const result = {
          postCount,
          profileName,
          analyzedAt: now.toISOString(),
          url: window.location.href,
          posts: foundPosts.slice(0, 10),
          method: 'enhanced-analysis',
          debug: debugInfo
        };

        console.log('Enhanced analysis result:', result);
        resolve(result);
      }, 3000); // Reduced wait time but added better detection
    });
  }

  // Comprehensive profile name extraction
  extractProfileNameComprehensive() {
    console.log('Extracting profile name...');
    
    // Strategy 1: Standard selectors (updated for 2025)
    const nameSelectors = [
      'h1[data-anonymize="person-name"]',
      '.text-heading-xlarge',
      '.pv-text-details__left-panel h1',
      '.pv-text-details h1',
      '.pv-top-card h1',
      '[data-view-name="profile-top-card"] h1',
      '.pv-top-card--list h1',
      '.ph5 h1',
      'main h1',
      '.scaffold-layout__main h1',
      '.scaffold-layout h1',
      '.pv-profile-section h1',
      '[class*="profile"] h1',
      '.text-heading-large',
      '.artdeco-entity-lockup__title',
      '.pv-entity__summary-info h1',
      '.pv-top-card-v2__name',
      // Additional 2025 selectors
      '[data-field="headline"] + div h1',
      '.pv-top-card .text-heading-xlarge',
      '.pv-text-details .text-heading-xlarge'
    ];

    for (const selector of nameSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`Trying selector ${selector}, found ${elements.length} elements`);
        
        for (const element of elements) {
          if (element && element.textContent) {
            const name = element.textContent.trim();
            console.log(`Checking name: "${name}"`);
            if (this.isValidName(name)) {
              console.log(`Valid name found with selector ${selector}: ${name}`);
              return name;
            }
          }
        }
      } catch (e) {
        console.warn(`Error with selector ${selector}:`, e);
      }
    }

    // Strategy 2: Meta tags and title
    console.log('Trying meta tags and title...');
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      const name = this.cleanNameFromTitle(ogTitle.content);
      if (this.isValidName(name)) {
        console.log('Found name in og:title:', name);
        return name;
      }
    }

    const title = document.title;
    if (title) {
      const cleanName = this.cleanNameFromTitle(title);
      if (this.isValidName(cleanName)) {
        console.log('Found name in title:', cleanName);
        return cleanName;
      }
    }

    // Strategy 3: Structured data
    console.log('Trying structured data...');
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.name && this.isValidName(data.name)) {
          console.log('Found name in structured data:', data.name);
          return data.name;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('No valid name found');
    return 'Unknown';
  }

  // Comprehensive post finding with better debugging
  findAllRecentPostsComprehensive(cutoffTime, debugInfo) {
    console.log('Finding recent posts...');
    
    const posts = [];
    const processedContent = new Set();
    
    // Comprehensive list of selectors (updated for 2025)
    const postSelectors = [
      // Primary activity selectors
      '.pv-recent-activity-detail-v2',
      '.pvs-list__item--with-top-padding',
      '[data-view-name="profile-component-entity"]',
      '.pv-entity__summary-info',
      
      // Feed selectors
      '.feed-shared-update-v2',
      '.update-components-text',
      '.feed-shared-text',
      '.scaffold-finite-scroll__content .feed-shared-update-v2',
      
      // New layout selectors (2024/2025)
      '[data-view-name="profile-recent-activity"] .pvs-list__item',
      '.pv-profile-section .pvs-list__item',
      '.artdeco-card .update-components-text',
      '.pvs-entity',
      '.pvs-list__item',
      
      // Activity-specific selectors
      '[data-view-name*="activity"] [class*="entity"]',
      '[data-view-name*="activity"] .pvs-list__item',
      '.pv-recent-activity-section-v2 [class*="entity"]',
      '.artdeco-card [class*="update"]',
      '.scaffold-layout [class*="activity"]',
      
      // Additional comprehensive selectors
      '[class*="recent-activity"] [class*="item"]',
      '[class*="feed"] [class*="update"]',
      '[class*="post"] [class*="content"]',
      '[class*="activity"] [class*="summary"]',
      '.pv-profile-section__card-item',
      '.pv-entity-lockup',
      '.artdeco-entity-lockup',
      '[data-control-name*="activity"]',
      '[data-control-name*="post"]',
      
      // More generic but targeted selectors
      '.artdeco-card',
      '.pvs-list__item',
      '[data-view-name*="feed"] [class*="item"]',
      '.pv-shared-text-with-see-more'
    ];

    debugInfo.selectorsAttempted = postSelectors.length;
    let totalElementsFound = 0;

    postSelectors.forEach((selector, index) => {
      try {
        const elements = document.querySelectorAll(selector);
        totalElementsFound += elements.length;
        
        console.log(`Selector ${index + 1}/${postSelectors.length}: "${selector}" - found ${elements.length} elements`);

        elements.forEach((element, elementIndex) => {
          try {
            const post = this.extractPostFromElementEnhanced(element, cutoffTime, processedContent);
            if (post) {
              posts.push(post);
              console.log(`Found post ${posts.length}: ${post.text.substring(0, 50)}...`);
            }
          } catch (postError) {
            console.warn(`Error processing element ${elementIndex} from selector "${selector}":`, postError);
            debugInfo.errors = debugInfo.errors || [];
            debugInfo.errors.push(`Selector "${selector}" element ${elementIndex}: ${postError.message}`);
          }
        });
      } catch (selectorError) {
        console.warn(`Error with selector "${selector}":`, selectorError);
        debugInfo.errors = debugInfo.errors || [];
        debugInfo.errors.push(`Selector "${selector}": ${selectorError.message}`);
      }
    });

    debugInfo.elementsFound = totalElementsFound;
    console.log(`Total elements scanned: ${totalElementsFound}, Posts found: ${posts.length}`);

    return posts;
  }

  // Enhanced post extraction with better time detection
  extractPostFromElementEnhanced(element, cutoffTime, processedContent) {
    try {
      const content = element.textContent.trim();
      const contentKey = content.substring(0, 100);

      // Skip if already processed or too short
      if (processedContent.has(contentKey) || content.length < 15) {
        return null;
      }

      let isRecent = false;
      let timeFound = '';

      // Enhanced time detection
      const timeElement = this.findTimeElementEnhanced(element);
      
      if (timeElement) {
        const result = this.parseTimeElementEnhanced(timeElement, cutoffTime);
        if (result) {
          isRecent = result.isRecent;
          timeFound = result.timeFound;
        }
      }

      // Enhanced text-based time detection
      if (!isRecent) {
        const textResult = this.parseTimeFromTextEnhanced(content);
        if (textResult) {
          isRecent = textResult.isRecent;
          timeFound = textResult.timeFound;
        }
      }

      if (!isRecent) {
        return null;
      }

      processedContent.add(contentKey);

      // Determine post type with enhanced detection
      let postType = 'text';
      if (element.querySelector('img, .feed-shared-image, [data-view-name="feed-shared-image"], [class*="image"]')) {
        postType = 'image';
      } else if (element.querySelector('video, .feed-shared-video, [data-view-name="feed-shared-video"], [class*="video"]')) {
        postType = 'video';
      } else if (element.querySelector('.feed-shared-article, .feed-shared-link, [data-view-name="feed-shared-article"], [class*="article"]')) {
        postType = 'article';
      }

      return {
        text: content.substring(0, 150) + (content.length > 150 ? '...' : ''),
        time: timeFound,
        type: postType
      };
    } catch (error) {
      console.warn('Error extracting post from element:', error);
      return null;
    }
  }

  // Enhanced time element finding
  findTimeElementEnhanced(element) {
    const timeSelectors = [
      'time[datetime]',
      '.update-components-actor__sub-description time',
      '.feed-shared-update-v2__description time',
      '.update-components-text time',
      '[data-view-name*="time"] time',
      '.artdeco-card time',
      '.pvs-list__item time',
      '.pv-entity__summary-info time',
      '[class*="time"] time',
      '[class*="timestamp"] time',
      '.pv-shared-text-with-see-more time',
      // Additional time selectors
      '.feed-shared-actor__sub-description time',
      '.update-components-actor time',
      '[aria-label*="ago"] time',
      '[title*="ago"] time'
    ];

    // Check within element first
    for (const selector of timeSelectors) {
      const timeEl = element.querySelector(selector);
      if (timeEl) return timeEl;
    }

    // Check in parent containers with expanded search
    const parentSelectors = [
      '.pvs-list__item',
      '.pv-list-item', 
      '.feed-shared-update-v2', 
      '.artdeco-card', 
      '.pv-recent-activity-detail-v2',
      '.pv-entity__summary-info',
      '.pv-profile-section__card-item',
      '.artdeco-entity-lockup',
      '.update-components-text',
      '.feed-shared-text'
    ];

    for (const parentSelector of parentSelectors) {
      const parent = element.closest(parentSelector);
      if (parent) {
        for (const selector of timeSelectors) {
          const timeEl = parent.querySelector(selector);
          if (timeEl) return timeEl;
        }
      }
    }

    return null;
  }

  // Enhanced time parsing
  parseTimeElementEnhanced(timeElement, cutoffTime) {
    try {
      // Try datetime attribute first
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        const postDate = new Date(datetime);
        const now = new Date();
        
        if (!isNaN(postDate.getTime()) && postDate >= cutoffTime && postDate <= now) {
          return {
            isRecent: true,
            timeFound: datetime
          };
        }
      }

      // Try aria-label or title attributes
      const ariaLabel = timeElement.getAttribute('aria-label');
      if (ariaLabel) {
        const textResult = this.parseTimeFromTextEnhanced(ariaLabel);
        if (textResult) {
          return textResult;
        }
      }

      const title = timeElement.getAttribute('title');
      if (title) {
        const textResult = this.parseTimeFromTextEnhanced(title);
        if (textResult) {
          return textResult;
        }
      }

    } catch (e) {
      console.warn('Error parsing time element:', e);
    }
    return null;
  }

  // Enhanced text-based time parsing
  parseTimeFromTextEnhanced(content) {
    const text = content.toLowerCase();
    
    const timePatterns = [
      // Minutes
      { pattern: /(\d+)\s*m(?:in|inute)?s?\s*ago/i, maxValue: 1440, unit: 'minutes' },
      { pattern: /(\d+)m\s*ago/i, maxValue: 1440, unit: 'minutes' },
      { pattern: /(\d+)\s*mins?\s*ago/i, maxValue: 1440, unit: 'minutes' },
      
      // Hours
      { pattern: /(\d+)\s*h(?:our|r)?s?\s*ago/i, maxValue: 24, unit: 'hours' },
      { pattern: /(\d+)h\s*ago/i, maxValue: 24, unit: 'hours' },
      { pattern: /(\d+)\s*hrs?\s*ago/i, maxValue: 24, unit: 'hours' },
      
      // Days
      { pattern: /1\s*d(?:ay)?\s*ago/i, maxValue: 1, unit: 'days' },
      { pattern: /yesterday/i, maxValue: 1, unit: 'days' },
      
      // Additional patterns
      { pattern: /about\s*(\d+)\s*hours?\s*ago/i, maxValue: 24, unit: 'hours' },
      { pattern: /about\s*(\d+)\s*minutes?\s*ago/i, maxValue: 1440, unit: 'minutes' },
      { pattern: /(\d+)\s*h$/i, maxValue: 24, unit: 'hours' },
      { pattern: /(\d+)\s*m$/i, maxValue: 1440, unit: 'minutes' }
    ];

    for (const { pattern, maxValue, unit } of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        if (unit === 'days' || pattern.source.includes('yesterday')) {
          return {
            isRecent: true,
            timeFound: `Text: ${match[0]}`
          };
        }
        
        const value = parseInt(match[1]) || 1;
        if (value <= maxValue) {
          return {
            isRecent: true,
            timeFound: `Text: ${match[0]}`
          };
        }
      }
    }

    return null;
  }

  // Super enhanced fallback detection
  performSuperEnhancedFallback() {
    console.log('Performing super enhanced fallback detection...');
    
    try {
      const pageText = document.body.textContent.toLowerCase();
      const pageHTML = document.body.innerHTML.toLowerCase();
      
      // More comprehensive activity patterns
      const activityPatterns = [
        { pattern: /(\d+)\s*hour?s?\s*ago/g, weight: 2, timeLimit: 24 },
        { pattern: /(\d+)\s*minute?s?\s*ago/g, weight: 1, timeLimit: 1440 },
        { pattern: /1\s*day?\s*ago/g, weight: 2, timeLimit: 1 },
        { pattern: /yesterday/g, weight: 2, timeLimit: 1 },
        { pattern: /(\d+)h\s*ago/g, weight: 1.5, timeLimit: 24 },
        { pattern: /(\d+)m\s*ago/g, weight: 1, timeLimit: 1440 },
        { pattern: /(\d+)\s*hrs?\s*ago/g, weight: 1.5, timeLimit: 24 },
        { pattern: /(\d+)\s*mins?\s*ago/g, weight: 1, timeLimit: 1440 },
        // New patterns
        { pattern: /about\s*(\d+)\s*hours?\s*ago/g, weight: 1.5, timeLimit: 24 },
        { pattern: /about\s*(\d+)\s*minutes?\s*ago/g, weight: 1, timeLimit: 1440 }
      ];

      let totalScore = 0;
      let validMatches = 0;

      activityPatterns.forEach(({ pattern, weight, timeLimit }) => {
        const matches = [...pageText.matchAll(pattern)];
        matches.forEach(match => {
          const value = parseInt(match[1]) || 1;
          
          // Check if within time limit
          let withinLimit = false;
          if (pattern.source.includes('hour')) {
            withinLimit = value <= timeLimit;
          } else if (pattern.source.includes('minute')) {
            withinLimit = value <= timeLimit;
          } else if (pattern.source.includes('day') || pattern.source.includes('yesterday')) {
            withinLimit = true; // Yesterday is always within 24 hours
          }
          
          if (withinLimit) {
            totalScore += weight;
            validMatches++;
          }
        });
      });

      // Enhanced contextual activity detection
      const activityKeywords = [
        'posted', 'shared', 'commented', 'liked', 'reacted', 'updated', 
        'published', 'wrote', 'added', 'created', 'uploaded', 'celebrated',
        'congratulated', 'started', 'joined', 'connected'
      ];
      
      let contextualActivity = 0;
      activityKeywords.forEach(keyword => {
        // Look for keyword + time pattern combinations within reasonable proximity
        const proximityPattern = new RegExp(`${keyword}.{0,200}(?:hour|minute|day|yesterday).{0,50}ago`, 'gi');
        const matches = pageText.match(proximityPattern);
        if (matches) {
          contextualActivity += matches.length * 0.8;
        }
        
        // Reverse pattern: time + keyword
        const reversePattern = new RegExp(`(?:hour|minute|day|yesterday).{0,50}ago.{0,200}${keyword}`, 'gi');
        const reverseMatches = pageText.match(reversePattern);
        if (reverseMatches) {
          contextualActivity += reverseMatches.length * 0.8;
        }
      });

      // Enhanced structural analysis
      const structuralPatterns = [
        /data-view-name="[^"]*activity[^"]*"/g,
        /data-view-name="[^"]*feed[^"]*"/g,
        /data-view-name="[^"]*post[^"]*"/g,
        /class="[^"]*activity[^"]*"/g,
        /class="[^"]*recent[^"]*"/g,
        /class="[^"]*update[^"]*"/g,
        /class="[^"]*feed[^"]*"/g
      ];

      let structuralActivity = 0;
      structuralPatterns.forEach(pattern => {
        const matches = pageHTML.match(pattern);
        if (matches) {
          structuralActivity += matches.length * 0.2;
        }
      });

      // Calculate final score with refined weighting
      const finalScore = totalScore + (contextualActivity * 0.7) + (structuralActivity * 0.3);
      const estimatedPosts = Math.max(0, Math.min(Math.round(finalScore / 3), 12));

      console.log('Super enhanced fallback results:', {
        totalScore,
        contextualActivity,
        structuralActivity,
        finalScore,
        estimatedPosts,
        validMatches
      });

      return estimatedPosts;
    } catch (e) {
      console.error('Error in super enhanced fallback detection:', e);
      return 0;
    }
  }

  // Ultimate fallback analysis (from previous version but enhanced)
  ultimateFallbackAnalysis() {
    console.log('Running ultimate fallback analysis...');
    
    const now = new Date();
    let profileName = 'Unknown';
    let postCount = 0;
    const detectionMethods = [];

    try {
      // Method 1: Comprehensive name detection
      const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, .text-heading-xlarge, .text-heading-large, [class*="heading"]'));
      
      for (const heading of allHeadings) {
        if (heading && heading.textContent) {
          const text = heading.textContent.trim();
          if (this.isValidName(text)) {
            profileName = text;
            detectionMethods.push('heading-scan');
            break;
          }
        }
      }

      // Method 2: Try meta tags and title
      if (profileName === 'Unknown') {
        const title = document.title;
        const ogTitle = document.querySelector('meta[property="og:title"]');
        
        if (ogTitle && ogTitle.content) {
          const ogName = this.cleanNameFromTitle(ogTitle.content);
          if (this.isValidName(ogName)) {
            profileName = ogName;
            detectionMethods.push('og-title');
          }
        }
        
        if (profileName === 'Unknown' && title) {
          const titleName = this.cleanNameFromTitle(title);
          if (this.isValidName(titleName)) {
            profileName = titleName;
            detectionMethods.push('page-title');
          }
        }
      }

      // Method 3: Comprehensive activity detection
      const pageContent = document.documentElement.innerHTML.toLowerCase();
      const bodyText = document.body.textContent.toLowerCase();

      // Enhanced time pattern detection
      const timePatterns = [
        { pattern: /(\d+)\s*(?:minute|min)s?\s*ago/g, weight: 1, maxHours: 24 },
        { pattern: /(\d+)\s*(?:hour|hr)s?\s*ago/g, weight: 1.5, maxHours: 24 },
        { pattern: /(\d+)h\s*ago/g, weight: 1.5, maxHours: 24 },
        { pattern: /(\d+)m\s*ago/g, weight: 1, maxHours: 24 },
        { pattern: /1\s*(?:day|d)\s*ago/g, weight: 2, maxHours: 24 },
        { pattern: /yesterday/gi, weight: 2, maxHours: 24 },
        { pattern: /\b(\d+)\s*hr\b/g, weight: 1, maxHours: 24 },
        { pattern: /\b(\d+)\s*min\b/g, weight: 0.5, maxHours: 24 },
        // Additional patterns
        { pattern: /about\s*(\d+)\s*hours?\s*ago/g, weight: 1.5, maxHours: 24 },
        { pattern: /about\s*(\d+)\s*minutes?\s*ago/g, weight: 1, maxHours: 24 }
      ];

      let recentActivityCount = 0;
      const foundTimes = [];

      timePatterns.forEach(({ pattern, weight, maxHours }) => {
        const matches = [...bodyText.matchAll(pattern)];
        matches.forEach(match => {
          const value = parseInt(match[1]) || 1;
          let totalHours = 0;
          
          if (pattern.source.includes('hour') || pattern.source.includes('hr')) {
            totalHours = value;
          } else if (pattern.source.includes('minute') || pattern.source.includes('min')) {
            totalHours = value / 60;
          } else if (pattern.source.includes('day') || pattern.source.includes('yesterday')) {
            totalHours = 24;
          }
          
          if (totalHours <= maxHours) {
            recentActivityCount += weight;
            foundTimes.push(match[0]);
          }
        });
      });

      // Enhanced activity keywords detection
      const activityKeywords = [
        'posted', 'shared', 'commented', 'liked', 'reacted', 'updated', 
        'published', 'wrote', 'added', 'created', 'uploaded', 'celebrated',
        'congratulated', 'started', 'joined', 'connected', 'recommended'
      ];
      
      let contextualActivity = 0;
      activityKeywords.forEach(keyword => {
        const keywordPattern = new RegExp(`${keyword}.{0,100}(?:hour|minute|day|yesterday).{0,30}ago`, 'gi');
        const matches = bodyText.match(keywordPattern);
        if (matches) {
          contextualActivity += matches.length;
        }
        
        // Reverse pattern
        const reversePattern = new RegExp(`(?:hour|minute|day|yesterday).{0,30}ago.{0,100}${keyword}`, 'gi');
        const reverseMatches = bodyText.match(reversePattern);
        if (reverseMatches) {
          contextualActivity += reverseMatches.length;
        }
      });

      // LinkedIn-specific indicators
      const linkedinIndicators = [
        /posted.*?on\s*linkedin/gi,
        /shared.*?post/gi,
        /commented.*?on.*?post/gi,
        /liked.*?post/gi,
        /reacted.*?to/gi,
        /updated.*?status/gi
      ];

      let linkedinActivity = 0;
      linkedinIndicators.forEach(pattern => {
        const matches = bodyText.match(pattern);
        if (matches) {
          linkedinActivity += matches.length;
        }
      });

      // Calculate final post count with improved algorithm
      const baseScore = Math.min(recentActivityCount, 15);
      const contextScore = Math.min(contextualActivity * 0.3, 5);
      const linkedinScore = Math.min(linkedinActivity * 0.4, 3);
      
      const totalScore = baseScore + contextScore + linkedinScore;
      postCount = Math.max(0, Math.min(Math.round(totalScore / 2), 20));

      if (recentActivityCount > 0) {
        detectionMethods.push('time-pattern-scan');
      }
      if (contextualActivity > 0) {
        detectionMethods.push('contextual-activity');
      }
      if (linkedinActivity > 0) {
        detectionMethods.push('linkedin-indicators');
      }

      // Method 4: Element scanning for profile name if still unknown
      if (profileName === 'Unknown') {
        const profileIndicators = [
          () => document.querySelector('[data-anonymize="person-name"]')?.textContent?.trim(),
          () => {
            const spans = document.querySelectorAll('span');
            for (const span of spans) {
              const text = span.textContent?.trim();
              if (text && this.isValidName(text)) {
                return text;
              }
            }
            return null;
          },
          () => {
            const divs = document.querySelectorAll('div');
            for (const div of divs) {
              const text = div.textContent?.trim();
              if (text && text.length > 5 && text.length < 50 && this.isValidName(text)) {
                return text;
              }
            }
            return null;
          }
        ];

        for (const indicator of profileIndicators) {
          try {
            const name = indicator();
            if (name && this.isValidName(name)) {
              profileName = name;
              detectionMethods.push('element-scan');
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      console.log('Ultimate fallback results:', {
        profileName,
        postCount,
        recentActivityCount,
        contextualActivity,
        linkedinActivity,
        detectionMethods,
        foundTimesCount: foundTimes.length,
        totalScore: baseScore + contextScore + linkedinScore
      });

      return {
        postCount,
        profileName,
        analyzedAt: now.toISOString(),
        url: window.location.href,
        method: 'ultimate-fallback',
        detectionMethods,
        debug: {
          recentActivityCount,
          contextualActivity,
          linkedinActivity,
          foundTimesCount: foundTimes.length,
          pageHasLinkedInClass: document.body.className.includes('linkedin'),
          pageTitle: document.title,
          totalScore: baseScore + contextScore + linkedinScore
        }
      };
    } catch (error) {
      console.error('Ultimate fallback error:', error);
      return {
        postCount: 0,
        profileName: 'Error',
        analyzedAt: now.toISOString(),
        url: window.location.href,
        error: error.message,
        method: 'ultimate-fallback-error'
      };
    }
  }

  // Enhanced helper methods
  isValidName(name) {
    if (!name || typeof name !== 'string') return false;
    
    const cleanName = name.trim();
    
    // Enhanced validation
    return cleanName.length >= 2 && 
           cleanName.length <= 100 && 
           !cleanName.toLowerCase().includes('linkedin') &&
           !cleanName.toLowerCase().includes('profile') &&
           !cleanName.toLowerCase().includes('activity') &&
           !cleanName.toLowerCase().includes('recent') &&
           !cleanName.toLowerCase().includes('connection') &&
           !cleanName.toLowerCase().includes('view') &&
           !cleanName.toLowerCase().includes('show') &&
           !cleanName.toLowerCase().includes('edit') &&
           !cleanName.toLowerCase().includes('update') &&
           !cleanName.toLowerCase().includes('see all') &&
           !cleanName.toLowerCase().includes('see more') &&
           !cleanName.includes('(') && 
           !cleanName.includes(')') &&
           !cleanName.includes('[') &&
           !cleanName.includes(']') &&
           !/^\d+$/.test(cleanName) && 
           !/^[^a-zA-Z]*$/.test(cleanName) &&
           !cleanName.includes('@') &&
           !cleanName.includes('www.') &&
           !cleanName.includes('http') &&
           !/^(show|view|see|all|more|less|edit|update|follow|connect|message)$/i.test(cleanName) &&
           /[a-zA-Z]/.test(cleanName); // Must contain at least one letter
  }

  cleanNameFromTitle(title) {
    if (!title) return '';
    
    const patterns = [
      title.split(' | LinkedIn')[0],
      title.split(' | ')[0],
      title.split(' - LinkedIn')[0],
      title.split(' - ')[0],
      title.split(' · ')[0],
      title.split(' on LinkedIn')[0],
      title.split(' — ')[0],
      title.split(' • ')[0],
      title.split(' – ')[0]
    ];
    
    for (const pattern of patterns) {
      const cleanName = pattern.trim();
      if (this.isValidName(cleanName)) {
        return cleanName;
      }
    }
    
    return '';
  }

  showLoading() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.className = 'results loading';
    resultsDiv.classList.remove('hidden');

    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('successState').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
  }

  showSuccess(data) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.className = 'results success';

    document.getElementById('postCount').textContent = data.postCount;
    document.getElementById('profileName').textContent = data.profileName;
    document.getElementById('analysisTime').textContent = new Date(data.analyzedAt).toLocaleString();

    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('successState').classList.remove('hidden');
    document.getElementById('errorState').classList.add('hidden');
  }

  showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.className = 'results error';
    resultsDiv.classList.remove('hidden');

    document.getElementById('errorMessage').textContent = message;

    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
  }

  async storeResult(url, data) {
    try {
      await chrome.storage.local.set({
        lastAnalysis: {
          url,
          ...data
        }
      });
    } catch (error) {
      console.error('Failed to store result:', error);
    }
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get('lastAnalysis');
      if (result.lastAnalysis) {
        document.getElementById('profileUrl').value = result.lastAnalysis.url || '';
      }
    } catch (error) {
      console.error('Failed to load stored data:', error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LinkedInPopup();
});