// Content script for LinkedIn Post Counter
class LinkedInContentScript {
  constructor() {
    this.debugMode = true; // Enable detailed logging
    this.init();
  }

  init() {
    // Only run on LinkedIn profile pages
    if (!this.isLinkedInProfile()) {
      this.log('Not on LinkedIn profile page, exiting');
      return;
    }

    // Mark as injected
    window.linkedInExtensionInjected = true;
    
    this.setupMessageListener();
    this.observePageChanges();
    
    this.log('LinkedIn Post Counter content script initialized');
    this.log('Current URL:', window.location.href);
  }

  log(...args) {
    if (this.debugMode) {
      console.log('[LinkedIn Extension]', ...args);
    }
  }

  isLinkedInProfile() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    const isLinkedIn = (hostname.includes('linkedin.com') || hostname.includes('www.linkedin.com'));
    const isProfile = (pathname.includes('/in/') || pathname.includes('/profile/'));
    
    this.log('Hostname:', hostname, 'Pathname:', pathname, 'Is LinkedIn:', isLinkedIn, 'Is Profile:', isProfile);
    
    return isLinkedIn && isProfile;
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.log('Received message:', request);
      
      if (request.action === 'analyzeProfile') {
        this.analyzeCurrentProfile()
          .then(result => {
            this.log('Analysis complete:', result);
            sendResponse({ success: true, data: result });
          })
          .catch(error => {
            this.log('Analysis error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep message channel open for async response
      }
    });
  }

  observePageChanges() {
    // LinkedIn is a SPA, so we need to observe navigation changes
    let currentUrl = window.location.href;

    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        this.log('URL changed from', currentUrl, 'to', window.location.href);
        currentUrl = window.location.href;
        if (this.isLinkedInProfile()) {
          // Wait for content to load after navigation
          setTimeout(() => this.onProfilePageLoad(), 3000);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  onProfilePageLoad() {
    this.log('LinkedIn profile page loaded, ready for analysis');
  }

  async analyzeCurrentProfile() {
    this.log('Starting profile analysis...');
    
    return new Promise((resolve) => {
      // Wait longer for dynamic content to load
      setTimeout(() => {
        try {
          const result = this.extractProfileData();
          this.log('Profile data extracted:', result);
          resolve(result);
        } catch (error) {
          this.log('Error in extractProfileData:', error);
          resolve({
            postCount: 0,
            profileName: 'Error',
            analyzedAt: new Date().toISOString(),
            url: window.location.href,
            error: error.message,
            debug: { error: error.message }
          });
        }
      }, 5000); // Increased wait time
    });
  }

  extractProfileData() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    let postCount = 0;
    let profileName = 'Unknown';
    let posts = [];
    const debugInfo = {
      url: window.location.href,
      title: document.title,
      timestamp: now.toISOString(),
      pageReadyState: document.readyState,
      bodyLength: document.body ? document.body.textContent.length : 0,
      errors: []
    };

    this.log('Starting data extraction...');
    this.log('Document ready state:', document.readyState);
    this.log('Page title:', document.title);

    try {
      // Extract profile name with comprehensive approach
      profileName = this.extractProfileNameEnhanced();
      debugInfo.profileNameMethod = 'enhanced';
      debugInfo.profileNameFound = profileName !== 'Unknown';
      this.log('Profile name extracted:', profileName);
      
      // Find recent posts with multiple strategies
      posts = this.findRecentPostsEnhanced(twentyFourHoursAgo, debugInfo);
      postCount = posts.length;
      this.log('Posts found through direct analysis:', postCount);

      // Enhanced fallback detection if no posts found
      if (postCount === 0) {
        this.log('No posts found, trying enhanced fallback detection...');
        const fallbackResult = this.performAdvancedFallbackDetection();
        if (fallbackResult.count > 0) {
          postCount = fallbackResult.count;
          posts.push({
            text: 'Recent activity detected via enhanced text analysis',
            time: 'Estimated from page content',
            type: 'fallback-detection',
            details: fallbackResult.details
          });
          debugInfo.usedFallback = true;
          debugInfo.fallbackDetails = fallbackResult.details;
        }
        this.log('Fallback detection result:', fallbackResult);
      }

      // Final validation
      if (profileName === 'Unknown' && postCount === 0) {
        this.log('No valid data found, performing emergency analysis...');
        const emergencyResult = this.performEmergencyAnalysis();
        if (emergencyResult.profileName !== 'Unknown') {
          profileName = emergencyResult.profileName;
        }
        if (emergencyResult.activityScore > 0) {
          postCount = Math.min(emergencyResult.activityScore, 5);
          posts.push({
            text: 'Activity detected through emergency analysis',
            time: 'Estimated',
            type: 'emergency-detection'
          });
        }
        debugInfo.usedEmergencyAnalysis = true;
        debugInfo.emergencyResult = emergencyResult;
      }

    } catch (error) {
      this.log('Error extracting profile data:', error);
      debugInfo.errors.push(error.message);
    }

    const result = {
      postCount,
      profileName,
      analyzedAt: now.toISOString(),
      url: window.location.href,
      posts: posts.map(post => ({
        text: post.text?.substring(0, 150) + (post.text?.length > 150 ? '...' : ''),
        time: post.time,
        type: post.type,
        details: post.details
      })),
      debug: debugInfo
    };

    this.log('Final analysis result:', result);
    return result;
  }

  extractProfileNameEnhanced() {
    this.log('Extracting profile name...');
    
    // Comprehensive name extraction with multiple strategies
    const strategies = [
      () => this.extractNameFromSelectors(),
      () => this.extractNameFromTitle(),
      () => this.extractNameFromMetaTags(),
      () => this.extractNameFromStructuredData(),
      () => this.extractNameFromPageText()
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        this.log(`Trying name extraction strategy ${i + 1}...`);
        const name = strategies[i]();
        if (name && this.isValidProfileName(name)) {
          this.log(`Strategy ${i + 1} found valid name:`, name);
          return name;
        } else if (name) {
          this.log(`Strategy ${i + 1} found invalid name:`, name);
        }
      } catch (e) {
        this.log(`Strategy ${i + 1} failed:`, e.message);
        continue;
      }
    }

    this.log('No valid name found');
    return 'Unknown';
  }

  extractNameFromSelectors() {
    // Enhanced list of selectors for LinkedIn profile names (2025 update)
    const nameSelectors = [
      // Primary modern LinkedIn selectors
      'h1[data-anonymize="person-name"]',
      '.text-heading-xlarge',
      '.pv-text-details__left-panel h1',
      '.pv-text-details h1',
      '.pv-top-card h1',
      
      // Secondary selectors
      '[data-view-name="profile-top-card"] h1',
      '.pv-top-card--list h1',
      '.ph5 h1',
      'main h1',
      '.scaffold-layout__main h1',
      '.scaffold-layout h1',
      
      // Additional fallback selectors
      '.pv-profile-section h1',
      '[class*="profile"] h1',
      '.text-heading-large',
      '.artdeco-entity-lockup__title',
      '.pv-entity__summary-info h1',
      '.pv-top-card-v2__name',
      '.pv-top-card__name',
      
      // More generic selectors as last resort
      '[data-test-id*="name"] h1',
      '[aria-label*="name"] h1',
      'h1[class*="heading"]',
      '.profile-rail h1',
      '.profile-info h1',
      
      // New 2025 selectors based on recent LinkedIn updates
      '[data-field="headline"] + div h1',
      '.pv-top-card .text-heading-xlarge',
      '.pv-text-details .text-heading-xlarge',
      '.profile-header h1',
      '.member-profile h1'
    ];

    this.log(`Trying ${nameSelectors.length} name selectors...`);

    for (let i = 0; i < nameSelectors.length; i++) {
      const selector = nameSelectors[i];
      try {
        const elements = document.querySelectorAll(selector);
        this.log(`Selector "${selector}" found ${elements.length} elements`);
        
        for (const element of elements) {
          if (element && element.textContent) {
            const name = element.textContent.trim();
            this.log(`Checking name from "${selector}": "${name}"`);
            if (this.isValidProfileName(name)) {
              return name;
            }
          }
        }
      } catch (e) {
        this.log(`Error with selector "${selector}":`, e.message);
        continue;
      }
    }

    return null;
  }

  extractNameFromTitle() {
    try {
      const title = document.title;
      this.log('Page title:', title);
      
      if (!title) return null;
      
      // Multiple title parsing patterns
      const titlePatterns = [
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
      
      for (const pattern of titlePatterns) {
        const cleanName = pattern.trim();
        this.log('Checking title pattern:', cleanName);
        if (this.isValidProfileName(cleanName)) {
          return cleanName;
        }
      }
    } catch (e) {
      this.log('Error extracting name from title:', e);
    }
    
    return null;
  }

  extractNameFromMetaTags() {
    try {
      const metaSelectors = [
        'meta[property="og:title"]',
        'meta[property="twitter:title"]',
        'meta[name="title"]',
        'meta[property="profile:first_name"]',
        'meta[name="author"]'
      ];

      for (const selector of metaSelectors) {
        const meta = document.querySelector(selector);
        if (meta && meta.content) {
          this.log(`Meta tag "${selector}" content:`, meta.content);
          const name = this.cleanNameFromTitle(meta.content);
          if (this.isValidProfileName(name)) {
            return name;
          }
        }
      }
    } catch (e) {
      this.log('Error extracting name from meta tags:', e);
    }

    return null;
  }

  extractNameFromStructuredData() {
    try {
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      this.log(`Found ${jsonLdScripts.length} JSON-LD scripts`);
      
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data.name && this.isValidProfileName(data.name)) {
            return data.name;
          }
          if (data['@graph']) {
            const person = data['@graph'].find(item => item['@type'] === 'Person');
            if (person && person.name && this.isValidProfileName(person.name)) {
              return person.name;
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      this.log('Error extracting name from structured data:', e);
    }

    return null;
  }

  extractNameFromPageText() {
    try {
      // Look for patterns in page text that might indicate a name
      const pageText = document.body.textContent;
      
      // Look for "View [Name]'s profile" patterns
      const profileViewPattern = /View\s+([A-Z][a-zA-Z\s'-]{1,50})'s\s+profile/i;
      const match = pageText.match(profileViewPattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (this.isValidProfileName(name)) {
          return name;
        }
      }

      // Look for "[Name] is on LinkedIn" patterns
      const linkedinPattern = /([A-Z][a-zA-Z\s'-]{1,50})\s+is\s+on\s+LinkedIn/i;
      const linkedinMatch = pageText.match(linkedinPattern);
      if (linkedinMatch && linkedinMatch[1]) {
        const name = linkedinMatch[1].trim();
        if (this.isValidProfileName(name)) {
          return name;
        }
      }
    } catch (e) {
      this.log('Error extracting name from page text:', e);
    }

    return null;
  }

  findRecentPostsEnhanced(cutoffTime, debugInfo) {
    const posts = [];
    const processedContent = new Set();
    
    this.log('Searching for recent posts...');

    // Enhanced and comprehensive list of selectors for LinkedIn posts and activities
    const activitySelectors = [
      // Primary activity section selectors
      '.pv-recent-activity-detail-v2',
      '.pvs-list__item--with-top-padding',
      '[data-view-name="profile-component-entity"]',
      '.pv-entity__summary-info',
      
      // Feed and post selectors
      '.feed-shared-update-v2',
      '.update-components-text',
      '.feed-shared-text',
      '.scaffold-finite-scroll__content .feed-shared-update-v2',
      
      // Modern LinkedIn layout selectors (2024/2025)
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
      
      // Broader selectors for various layouts
      '[class*="recent-activity"] [class*="item"]',
      '[class*="feed"] [class*="update"]',
      '[class*="post"] [class*="content"]',
      '[class*="activity"] [class*="summary"]',
      
      // Additional comprehensive selectors
      '.pv-profile-section__card-item',
      '.pv-entity-lockup',
      '.artdeco-entity-lockup',
      '[data-control-name*="activity"]',
      '[data-control-name*="post"]',
      
      // New 2025 selectors
      '.feed-shared-update-v2__description-wrapper',
      '.update-components-text__text-view',
      '.pv-shared-text-with-see-more',
      '.artdeco-card .pv-shared-text-with-see-more',
      '[data-view-name*="recent-activity"] .artdeco-card'
    ];

    let totalElementsScanned = 0;
    debugInfo.selectorsAttempted = activitySelectors.length;

    activitySelectors.forEach((selector, index) => {
      try {
        const elements = document.querySelectorAll(selector);
        totalElementsScanned += elements.length;
        
        if (elements.length > 0) {
          this.log(`Selector ${index + 1}/${activitySelectors.length}: "${selector}" - found ${elements.length} elements`);
        }

        elements.forEach((element, elementIndex) => {
          try {
            const post = this.extractPostFromElement(element, cutoffTime, processedContent);
            if (post) {
              posts.push(post);
              this.log(`Found recent post ${posts.length}: ${post.text.substring(0, 50)}...`);
            }
          } catch (postError) {
            this.log(`Error processing element ${elementIndex} from selector "${selector}":`, postError);
            debugInfo.errors = debugInfo.errors || [];
            debugInfo.errors.push(`Selector "${selector}" element ${elementIndex}: ${postError.message}`);
          }
        });
      } catch (selectorError) {
        this.log(`Error with selector "${selector}":`, selectorError);
        debugInfo.errors = debugInfo.errors || [];
        debugInfo.errors.push(`Selector "${selector}": ${selectorError.message}`);
      }
    });

    debugInfo.elementsScanned = totalElementsScanned;
    this.log(`Total elements scanned: ${totalElementsScanned}, Posts found: ${posts.length}`);

    // Look specifically in activity section if URL suggests we're there
    if (window.location.href.includes('/recent-activity/') || 
        window.location.href.includes('/detail/recent-activity/')) {
      this.findActivityFeedPosts(cutoffTime, posts, processedContent);
    }

    return posts;
  }

  findActivityFeedPosts(cutoffTime, posts, processedContent) {
    this.log('Scanning activity feed...');
    
    // Activity feed specific selectors
    const feedSelectors = [
      '.scaffold-finite-scroll__content > div',
      '.feed-shared-update-v2',
      '.update-components-text',
      '.pv-recent-activity-detail-v2',
      '.artdeco-card',
      '[data-view-name*="feed"] [class*="item"]',
      '.feed-container .feed-shared-update-v2'
    ];

    feedSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        this.log(`Activity feed selector "${selector}" found ${elements.length} elements`);
        
        elements.forEach(element => {
          const post = this.extractPostFromElement(element, cutoffTime, processedContent);
          if (post) {
            posts.push(post);
            this.log(`Found activity feed post: ${post.text.substring(0, 50)}...`);
          }
        });
      } catch (e) {
        this.log('Error in activity feed selector:', selector, e);
      }
    });
  }

  extractPostFromElement(element, cutoffTime, processedContent) {
    try {
      const content = element.textContent.trim();
      const contentKey = content.substring(0, 100);

      // Skip if already processed or too short
      if (processedContent.has(contentKey) || content.length < 15) {
        return null;
      }

      let isRecent = false;
      let timeStr = '';

      // Enhanced time detection with multiple strategies
      const timeElement = this.findTimeElement(element);
      
      if (timeElement) {
        const result = this.parseTimeElement(timeElement, cutoffTime);
        if (result) {
          isRecent = result.isRecent;
          timeStr = result.timeStr;
          this.log('Found time element result:', result);
        }
      }

      // Fallback to comprehensive text-based detection
      if (!isRecent) {
        const textResult = this.parseTimeFromText(content);
        if (textResult) {
          isRecent = textResult.isRecent;
          timeStr = textResult.timeStr;
          this.log('Found text-based time result:', textResult);
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
      } else if (element.querySelector('[class*="poll"], [data-view-name*="poll"]')) {
        postType = 'poll';
      }

      return {
        text: content,
        time: timeStr,
        type: postType
      };
    } catch (error) {
      this.log('Error extracting post from element:', error);
      return null;
    }
  }

  findTimeElement(element) {
    // Comprehensive time element detection with enhanced selectors
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
      '.feed-shared-actor__sub-description time',
      '.update-components-actor time',
      '[aria-label*="ago"] time',
      '[title*="ago"] time',
      // New selectors for 2025 LinkedIn updates
      '.feed-shared-update-v2__description-wrapper time',
      '.update-components-text__text-view time'
    ];

    // Check within element first
    for (const selector of timeSelectors) {
      const timeEl = element.querySelector(selector);
      if (timeEl) {
        this.log(`Found time element with selector: ${selector}`);
        return timeEl;
      }
    }

    // Check in parent containers with expanded list
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
          if (timeEl) {
            this.log(`Found time element in parent "${parentSelector}" with selector: ${selector}`);
            return timeEl;
          }
        }
      }
    }

    return null;
  }

  parseTimeElement(timeElement, cutoffTime) {
    try {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        const postDate = new Date(datetime);
        const now = new Date();
        
        if (!isNaN(postDate.getTime()) && postDate >= cutoffTime && postDate <= now) {
          return {
            isRecent: true,
            timeStr: datetime
          };
        } else {
          this.log('Post date outside range:', postDate, 'Cutoff:', cutoffTime);
        }
      }

      // Try other attributes
      const ariaLabel = timeElement.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.includes('ago')) {
        const textResult = this.parseTimeFromText(ariaLabel);
        if (textResult) {
          return textResult;
        }
      }

      const title = timeElement.getAttribute('title');
      if (title && title.includes('ago')) {
        const textResult = this.parseTimeFromText(title);
        if (textResult) {
          return textResult;
        }
      }
    } catch (e) {
      this.log('Error parsing datetime:', e);
    }
    return null;
  }

  parseTimeFromText(content) {
    const text = content.toLowerCase();
    
    // Comprehensive time patterns with various formats
    const recentPatterns = [
      { pattern: /(\d+)\s*m(?:in|inute)?s?\s*ago/, maxValue: 1440, unit: 'minutes' },
      { pattern: /(\d+)\s*h(?:our|r)?s?\s*ago/, maxValue: 24, unit: 'hours' },
      { pattern: /1\s*d(?:ay)?\s*ago/, maxValue: 1, unit: 'days' },
      { pattern: /yesterday/i, maxValue: 1, unit: 'days' },
      { pattern: /(\d+)h\s*ago/, maxValue: 24, unit: 'hours' },
      { pattern: /(\d+)m\s*ago/, maxValue: 1440, unit: 'minutes' },
      { pattern: /(\d+)\s*hrs?\s*ago/, maxValue: 24, unit: 'hours' },
      { pattern: /(\d+)\s*mins?\s*ago/, maxValue: 1440, unit: 'minutes' },
      // Additional patterns for different LinkedIn formats
      { pattern: /about\s*(\d+)\s*hours?\s*ago/, maxValue: 24, unit: 'hours' },
      { pattern: /about\s*(\d+)\s*minutes?\s*ago/, maxValue: 1440, unit: 'minutes' },
      // More patterns
      { pattern: /(\d+)\s*h$/, maxValue: 24, unit: 'hours' },
      { pattern: /(\d+)\s*m$/, maxValue: 1440, unit: 'minutes' }
    ];

    for (const { pattern, maxValue, unit } of recentPatterns) {
      const match = text.match(pattern);
      if (match) {
        this.log('Time pattern matched:', match[0], 'Unit:', unit);
        
        if (unit === 'days' || pattern.source.includes('yesterday')) {
          return {
            isRecent: true,
            timeStr: `Text: ${match[0]}`
          };
        }
        
        const value = parseInt(match[1]) || 1;
        if (value <= maxValue) {
          return {
            isRecent: true,
            timeStr: `Text: ${match[0]}`
          };
        } else {
          this.log('Time value too large:', value, 'Max:', maxValue);
        }
      }
    }

    return null;
  }

  performAdvancedFallbackDetection() {
    this.log('Performing advanced fallback detection...');
    
    try {
      const pageText = document.body.textContent.toLowerCase();
      const pageHTML = document.body.innerHTML.toLowerCase();
      
      // Enhanced activity patterns with more comprehensive matching
      const activityPatterns = [
        { pattern: /(\d+)\s*hour?s?\s*ago/g, weight: 2, maxHours: 24 },
        { pattern: /(\d+)\s*minute?s?\s*ago/g, weight: 1, maxHours: 24 },
        { pattern: /1\s*day?\s*ago/g, weight: 2, maxHours: 24 },
        { pattern: /yesterday/g, weight: 2, maxHours: 24 },
        { pattern: /(\d+)h\s*(?:ago)?/g, weight: 1.5, maxHours: 24 },
        { pattern: /(\d+)m\s*(?:ago)?/g, weight: 1, maxHours: 24 },
        { pattern: /(\d+)\s*hrs?\s*ago/g, weight: 1.5, maxHours: 24 },
        { pattern: /(\d+)\s*mins?\s*ago/g, weight: 1, maxHours: 24 },
        // Additional patterns
        { pattern: /about\s*(\d+)\s*hours?\s*ago/g, weight: 1.5, maxHours: 24 },
        { pattern: /about\s*(\d+)\s*minutes?\s*ago/g, weight: 1, maxHours: 24 }
      ];

      let totalScore = 0;
      const foundMatches = [];
      let timePatternScore = 0;

      activityPatterns.forEach(({ pattern, weight, maxHours }) => {
        const matches = [...pageText.matchAll(pattern)];
        matches.forEach(match => {
          const value = parseInt(match[1]) || 1;
          let timeInHours = 0;
          
          if (pattern.source.includes('hour') || pattern.source.includes('hr')) {
            timeInHours = value;
          } else if (pattern.source.includes('minute') || pattern.source.includes('min')) {
            timeInHours = value / 60;
          } else if (pattern.source.includes('day') || pattern.source.includes('yesterday')) {
            timeInHours = 24;
          }
          
          // Only count if within maxHours
          if (timeInHours <= maxHours) {
            timePatternScore += weight;
            foundMatches.push(match[0]);
          }
        });
      });

      // Look for activity keywords in proximity to time indicators
      const activityKeywords = [
        'posted', 'shared', 'commented', 'liked', 'reacted', 'updated', 
        'published', 'wrote', 'added', 'created', 'uploaded', 'celebrated',
        'congratulated', 'started', 'joined', 'connected', 'recommended'
      ];
      
      let contextualActivity = 0;
      activityKeywords.forEach(keyword => {
        // Look for keyword + time pattern combinations within reasonable distance
        const contextPattern = new RegExp(`${keyword}.{0,150}(?:hour|minute|day|yesterday).{0,50}ago`, 'gi');
        const matches = pageText.match(contextPattern);
        if (matches) {
          contextualActivity += matches.length * 0.8;
        }
        
        // Reverse pattern: time + keyword
        const reversePattern = new RegExp(`(?:hour|minute|day|yesterday).{0,50}ago.{0,150}${keyword}`, 'gi');
        const reverseMatches = pageText.match(reversePattern);
        if (reverseMatches) {
          contextualActivity += reverseMatches.length * 0.8;
        }
      });

      // Look for LinkedIn-specific activity indicators in HTML
      const linkedinPatterns = [
        /data-view-name="[^"]*activity[^"]*"/g,
        /data-view-name="[^"]*feed[^"]*"/g,
        /data-control-name="[^"]*activity[^"]*"/g,
        /data-control-name="[^"]*feed[^"]*"/g,
        /class="[^"]*activity[^"]*"/g,
        /class="[^"]*recent[^"]*"/g,
        /class="[^"]*update[^"]*"/g
      ];

      let structuralActivity = 0;
      linkedinPatterns.forEach(pattern => {
        const matches = pageHTML.match(pattern);
        if (matches) {
          structuralActivity += matches.length * 0.3;
        }
      });

      // Calculate final scores
      totalScore = timePatternScore + contextualActivity + structuralActivity;
      const estimatedPosts = Math.max(0, Math.min(Math.floor(totalScore / 2.5), 12));

      const details = {
        timePatternScore,
        contextualActivity,
        structuralActivity,
        totalScore,
        foundMatches: foundMatches.slice(0, 10), // Show first 10 matches
        uniqueMatches: [...new Set(foundMatches)].length
      };

      this.log('Advanced fallback detection results:', details);

      return {
        count: estimatedPosts,
        details
      };
    } catch (e) {
      this.log('Error in advanced fallback detection:', e);
      return { count: 0, details: { error: e.message } };
    }
  }

  performEmergencyAnalysis() {
    this.log('Performing emergency analysis...');
    
    try {
      let profileName = 'Unknown';
      let activityScore = 0;

      // Emergency name detection - look at any reasonable text
      const allTextElements = document.querySelectorAll('h1, h2, h3, span, div');
      for (const element of allTextElements) {
        if (element && element.textContent) {
          const text = element.textContent.trim();
          if (text.length > 3 && text.length < 60 && this.isValidProfileName(text)) {
            profileName = text;
            break;
          }
        }
      }

      // Emergency activity detection - very basic text analysis
      const bodyText = document.body.textContent.toLowerCase();
      const activityWords = ['ago', 'hour', 'minute', 'yesterday', 'posted', 'shared', 'activity', 'recent'];
      
      activityWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        const matches = bodyText.match(regex);
        if (matches) {
          activityScore += matches.length;
        }
      });

      // Very conservative scoring
      const finalScore = Math.min(Math.floor(activityScore / 20), 3);

      this.log('Emergency analysis results:', {
        profileName,
        activityScore: finalScore,
        rawActivityScore: activityScore
      });

      return {
        profileName,
        activityScore: finalScore,
        rawActivityScore: activityScore
      };
    } catch (e) {
      this.log('Error in emergency analysis:', e);
      return {
        profileName: 'Unknown',
        activityScore: 0,
        error: e.message
      };
    }
  }

  isValidProfileName(name) {
    if (!name || typeof name !== 'string') return false;
    
    const cleanName = name.trim();
    
    // Enhanced validation rules with more comprehensive checks
    const isValid = cleanName.length >= 2 && 
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
           !cleanName.toLowerCase().includes('follow') &&
           !cleanName.toLowerCase().includes('connect') &&
           !cleanName.toLowerCase().includes('message') &&
           !cleanName.includes('(') && 
           !cleanName.includes(')') &&
           !cleanName.includes('[') &&
           !cleanName.includes(']') &&
           !/^\d+$/.test(cleanName) && 
           !/^[^a-zA-Z]*$/.test(cleanName) &&
           !cleanName.includes('@') &&
           !cleanName.includes('www.') &&
           !cleanName.includes('http') &&
           !/^(show|view|see|all|more|less|edit|update|follow|connect|message|home|about|contact)$/i.test(cleanName) &&
           /[a-zA-Z]/.test(cleanName) && // Must contain at least one letter
           !/^\s*$/.test(cleanName); // Not just whitespace

    if (!isValid) {
      this.log(`Invalid name rejected: "${cleanName}"`);
    }

    return isValid;
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
      title.split(' – ')[0],
      title.split(' @ ')[0]
    ];
    
    for (const pattern of patterns) {
      const cleanName = pattern.trim();
      if (this.isValidProfileName(cleanName)) {
        return cleanName;
      }
    }
    
    return '';
  }
}

// Initialize content script with error handling
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new LinkedInContentScript();
    });
  } else {
    new LinkedInContentScript();
  }
} catch (error) {
  console.error('Failed to initialize LinkedIn content script:', error);
}