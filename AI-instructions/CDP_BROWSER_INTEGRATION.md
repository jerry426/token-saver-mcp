# Chrome DevTools Protocol (CDP) Browser Integration

## 🚀 Revolutionary Browser Control for AI Assistants

Token Saver MCP now includes groundbreaking Chrome DevTools Protocol integration, allowing AI assistants to directly control and interact with web browsers. This creates unprecedented capabilities for web automation, testing, debugging, and full-stack development.

## Features

### 8 New Browser Control Tools

1. **execute_in_browser** - Execute JavaScript in browser context
2. **get_browser_console** - Capture console messages (log, error, warning, info, debug)
3. **navigate_browser** - Navigate to any URL
4. **get_dom_snapshot** - Get current DOM structure with forms, links, and images
5. **click_element** - Click elements using CSS selectors
6. **type_in_browser** - Type text into input fields
7. **take_screenshot** - Capture browser screenshots
8. **wait_for_element** - Wait for elements to appear

## Quick Start

### 1. Test Basic Connection

```bash
# Run the standalone test
node test-cdp-standalone.js
```

### 2. Open Test Page in Browser

```bash
# Open the test page
open test-browser-page.html  # macOS
# or
start test-browser-page.html  # Windows
```

### 3. Use with AI Assistant

When using Claude or another AI assistant with Token Saver MCP:

```
AI: Navigate to example.com and get the page title
AI: Execute console.log("Hello from AI!") in the browser
AI: Click the submit button and capture any errors
AI: Take a screenshot of the current page
```

## Architecture

### CDP Bridge Components

```
src/cdp-bridge/
├── browser-launcher.ts   # Launches Chrome with debugging port
├── cdp-client.ts         # CDP connection and command management
└── (browser-tools.ts)    # MCP tool definitions (in src/mcp/)
```

### How It Works

1. **Browser Launch**: Chrome launches with `--remote-debugging-port=9222`
2. **CDP Connection**: WebSocket connection to Chrome's debugging interface
3. **Command Execution**: Direct access to Runtime, Console, Page, Network, DOM APIs
4. **Event Capture**: Real-time console messages, network requests, exceptions
5. **MCP Integration**: Tools exposed through Token Saver MCP server

## Use Cases

### Web Development & Debugging
- Debug JavaScript errors in real-time
- Monitor console output during development
- Test form submissions and validations
- Verify DOM manipulations

### Automated Testing
- Execute end-to-end tests
- Capture screenshots for visual regression
- Validate API responses
- Test user interactions

### Web Scraping & Data Extraction
- Navigate complex SPAs
- Extract data from dynamic content
- Handle authentication flows
- Monitor network requests

### Full-Stack Integration
- Debug client-server communication
- Test WebSocket connections
- Validate API integrations
- Monitor performance metrics

## Technical Details

### CDP Domains Used
- **Runtime**: JavaScript execution
- **Console**: Console message capture
- **Page**: Navigation and lifecycle
- **Network**: Request/response monitoring
- **DOM**: Document structure access

### Connection Management
- Singleton pattern for browser instance
- Automatic reconnection handling
- Port conflict resolution (9222, 9223, etc.)
- Graceful cleanup on disconnect

### Security Considerations
- Local-only connections (127.0.0.1)
- Isolated user data directory
- No remote access capabilities
- Controlled JavaScript execution

## Example Workflows

### 1. Debug a React Application

```javascript
// AI can execute this via execute_in_browser tool
React.version  // Check React version
document.querySelector('#root')._reactRootContainer  // Inspect React root
window.__REACT_DEVTOOLS_GLOBAL_HOOK__  // Check DevTools
```

### 2. Test Form Validation

```javascript
// Fill form and submit
await type_in_browser({ selector: '#email', text: 'invalid-email' })
await click_element({ selector: '#submit' })
await get_browser_console({ filter: 'error' })  // Capture validation errors
```

### 3. Monitor API Calls

```javascript
// Execute in browser to intercept fetch
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('API Call:', args[0]);
  const response = await originalFetch(...args);
  console.log('Response:', response.status);
  return response;
};
```

## Testing

### Unit Test
```bash
npm test src/cdp-bridge
```

### Integration Test
```bash
node test-cdp-standalone.js
```

### Manual Testing
1. Open `test-browser-page.html` in Chrome
2. Use VSCode extension with MCP tools
3. Try various browser interactions

## Troubleshooting

### Chrome Not Found
- Ensure Chrome is installed in standard location
- Check `browser-launcher.ts` for path detection

### Port Already in Use
- CDP uses port 9222 by default
- Extension tries alternative ports automatically
- Check for existing Chrome debug instances

### Connection Refused
- Verify Chrome launched with debugging port
- Check firewall settings for localhost
- Ensure no Chrome policies block debugging

## Future Enhancements

### Phase 2 Features
- [ ] Browser profile management
- [ ] Cookie and storage manipulation
- [ ] Network request interception
- [ ] Performance profiling
- [ ] Mobile device emulation
- [ ] Multi-tab support
- [ ] Headless mode optimization

### Phase 3 Vision
- [ ] Playwright/Puppeteer integration
- [ ] Recording and playback
- [ ] Visual testing capabilities
- [ ] Cross-browser support (Firefox, Safari)
- [ ] Cloud browser integration

## Contributing

The CDP integration is in active development. Contributions welcome:

1. Test with different websites
2. Report issues with specific frameworks
3. Suggest new browser control tools
4. Improve error handling

## The Revolution

This integration represents a paradigm shift in AI-assisted development:

- **Traditional**: AI suggests code, developer tests manually
- **Now**: AI writes code AND tests it in real browsers
- **Impact**: 10-100x productivity improvement

The combination of LSP (backend) + CDP (frontend) gives AI assistants unprecedented full-stack capabilities, fundamentally changing how we develop and debug web applications.

## License

MIT License - Part of Token Saver MCP