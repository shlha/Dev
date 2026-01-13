# LinkedIn Post Counter Chrome Extension

A Chrome extension that analyzes LinkedIn profiles to count posts published in the last 24 hours, built with respect for LinkedIn's terms of service.

## Features

- **24-Hour Post Analysis**: Counts posts, articles, and updates published in the last 24 hours
- **Profile Detection**: Automatically detects LinkedIn profile pages or allows manual URL input
- **Clean UI**: Simple, professional popup interface with loading states and error handling
- **Data Storage**: Remembers last analyzed profiles and maintains analysis history
- **Rate Limiting**: Built-in rate limiting to respect LinkedIn's usage policies
- **Multiple Post Types**: Detects text posts, images, videos, and articles

## Architecture

### File Structure
```
linkedin-post-counter/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic and user interaction
├── content.js             # Content script for LinkedIn page analysis
├── background.js          # Background service worker
└── README.md              # This file
```

### Technical Components

1. **Manifest V3 Compliance**: Uses the latest Chrome extension standards
2. **Content Scripts**: Analyzes LinkedIn DOM safely within the page context
3. **Background Service Worker**: Handles data storage and cross-tab communication
4. **Popup Interface**: User-friendly interface for interaction and results display

## Installation

### Development Installation

1. **Download the Extension Files**
   - Save all the provided code files in a directory called `linkedin-post-counter`

2. **Enable Developer Mode in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `linkedin-post-counter` directory
   - The extension should appear in your extensions list

4. **Pin the Extension** (Optional)
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "LinkedIn Post Counter" and click the pin icon

## Usage

### Method 1: Automatic Detection
1. Navigate to any LinkedIn profile page (e.g., `https://www.linkedin.com/in/username`)
2. Click the extension icon
3. Click "Use Current Tab"
4. The extension will analyze the current profile

### Method 2: Manual URL Input
1. Click the extension icon
2. Enter a LinkedIn profile URL in the format: `https://www.linkedin.com/in/username`
3. Click "Analyze Profile"
4. The extension will navigate to the profile and perform analysis

### Results
The extension will display:
- Number of posts in the last 24 hours
- Profile name
- Analysis timestamp
- Any errors encountered during analysis

## Technical Implementation

### DOM Analysis Strategy

The extension uses multiple fallback strategies to find recent posts:

1. **Time-based Detection**:
   - Searches for `<time datetime="">` elements
   - Parses ISO datetime strings
   - Compares against 24-hour cutoff

2. **Text-based Fallback**:
   - Looks for phrases like "1 hour ago", "2 hours ago"
   - Detects "1d" or "1 day ago" patterns
   - Handles various LinkedIn time formats

3. **Multiple Selectors**:
   - `.pv-recent-activity-detail-v2` (Activity section)
   - `.feed-shared-update-v2` (Feed updates)
   - `[data-view-name="profile-component-entity"]` (New layouts)
   - Various fallback selectors for different LinkedIn versions

### Data Storage

- **Local Storage**: Uses Chrome's `chrome.storage.local` API
- **Analysis History**: Keeps last 10 analysis results
- **Settings**: Stores user preferences and configuration
- **Rate Limiting**: Tracks request timestamps to prevent abuse

### Rate Limiting

Built-in rate limiting to respect LinkedIn's terms:
- Maximum 10 requests per minute
- Automatic cleanup of old request timestamps
- Graceful handling when limits are reached

## LinkedIn Compliance

### Terms of Service Respect
- **No Automated Scraping**: Only analyzes pages the user actively visits
- **Public Data Only**: Only reads publicly visible profile information
- **Rate Limited**: Prevents excessive requests that could burden LinkedIn's servers
- **User-Initiated**: All analysis requires explicit user action

### Privacy Considerations
- **No Data Collection**: Extension doesn't send data to external servers
- **Local Storage Only**: All data stays on user's device
- **No Background Monitoring**: Only analyzes when explicitly requested

## Limitations

### Technical Limitations
1. **Dynamic Content**: LinkedIn heavily uses JavaScript, so content may not be immediately available
2. **Layout Changes**: LinkedIn frequently updates their DOM structure
3. **Private Profiles**: Cannot analyze private or restricted profiles
4. **Connection Required**: User must be able to view the profile content

### Rate Limiting
- Maximum 10 analyses per minute
- Extension will show error if rate limit exceeded
- Designed to prevent abuse and respect LinkedIn's resources

### Detection Accuracy
- May miss posts if LinkedIn's time indicators are non-standard
- Accuracy depends on LinkedIn's current DOM structure
- Different LinkedIn layouts may require selector updates

## Troubleshooting

### Common Issues

1. **"Could not analyze profile" Error**
   - Ensure you're on a valid LinkedIn profile page
   - Wait for the page to fully load before analyzing
   - Check if the profile is public and accessible

2. **Rate Limit Exceeded**
   - Wait 1 minute before trying again
   - Avoid rapid successive analyses

3. **Incorrect Post Count**
   - LinkedIn's dynamic loading may affect accuracy
   - Try refreshing the profile page and analyzing again
   - Some private activity may not be visible

### Debug Mode
For developers, enable debug logging:
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for extension-specific log messages

## Future Enhancements

### Potential Features
- **Extended Time Ranges**: 7 days, 30 days analysis
- **Post Content Analysis**: Sentiment analysis, hashtag extraction
- **Export Functionality**: CSV/JSON export of analysis results
- **Bulk Analysis**: Multiple profiles at once
- **Engagement Metrics**: Likes, comments, shares counting

### API Integration
- **LinkedIn API**: Official API integration (requires LinkedIn partnership)
- **Authentication**: OAuth integration for private data access
- **Real-time Updates**: WebSocket connections for live monitoring

## Security Considerations

### Permissions Used
- `activeTab`: Access current tab content
- `storage`: Store analysis results locally
- `scripting`: Inject analysis scripts
- `https://*.linkedin.com/*`: Access LinkedIn pages only

### Data Handling
- No external data transmission
- No personal data collection
- Local storage encryption (browser-level)
- Automatic data cleanup

## Contributing

### Development Setup
1. Clone or download the extension files
2. Make modifications to the relevant components
3. Test using Chrome's developer mode
4. Submit improvements via pull request

### Code Style
- ES6+ JavaScript features
- Async/await for promises
- Comprehensive error handling
- JSDoc comments for functions

### Testing
- Test on various LinkedIn profile layouts
- Verify rate limiting functionality
- Check cross-browser compatibility
- Validate privacy compliance

## License

This extension is provided as-is for educational and personal use. Users are responsible for ensuring their usage complies with LinkedIn's Terms of Service.

## Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review Chrome extension developer documentation
3. Ensure compliance with LinkedIn's current terms of service
4. Test on publicly accessible LinkedIn profiles only

---

**Disclaimer**: This extension is not affiliated with LinkedIn Corporation. Use responsibly and in accordance with LinkedIn's Terms of Service.
