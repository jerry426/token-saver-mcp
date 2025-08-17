# Browser Helper Tools Documentation

## Overview

These are high-level wrapper tools that simplify common browser testing and debugging tasks. Each tool combines multiple CDP operations into a single, purpose-built function that AI can use without needing to understand the underlying CDP complexity.

## Available Helper Tools

### 1. `test_react_component`

**Purpose**: Test if a React component is properly rendered with correct props and state.

**What it does for you**:
- Navigates to your component's URL
- Waits for React to fully mount
- Detects React DevTools if available
- Finds your component in the DOM
- Captures any console errors
- Returns component state information

**Parameters**:
- `url` (required): Where your component lives (e.g., "http://localhost:3000/dashboard")
- `componentName` (required): Name of your React component (e.g., "Dashboard")
- `waitForSelector` (optional): CSS selector to wait for before testing

**Example**:
```javascript
test_react_component({
  url: "http://localhost:3000/users",
  componentName: "UserList",
  waitForSelector: ".user-table"
})
```

**Returns**:
```json
{
  "success": true,
  "component": "UserList",
  "mounted": true,
  "hasReactDevTools": true,
  "componentFound": true,
  "reactRoot": true,
  "errors": [],
  "domElementCount": 245,
  "consoleErrors": []
}
```

**When to use**: 
- After creating a new React component
- When debugging "component not rendering" issues
- To verify component mounted successfully
- To check for React-specific errors

---

### 2. `test_api_endpoint`

**Purpose**: Test an API endpoint directly from the browser context.

**What it does for you**:
- Navigates to your application
- Makes a fetch request from the browser
- Captures full response (status, headers, body)
- Checks for CORS issues automatically
- Measures request timing
- Handles both JSON and text responses

**Parameters**:
- `url` (required): Base URL of your application
- `endpoint` (required): API path (e.g., "/api/users")
- `method` (optional): HTTP method (GET, POST, PUT, DELETE, PATCH)
- `body` (optional): Request body as JSON string
- `headers` (optional): Additional headers object

**Example**:
```javascript
test_api_endpoint({
  url: "http://localhost:3000",
  endpoint: "/api/users",
  method: "POST",
  body: JSON.stringify({ name: "John", email: "john@example.com" }),
  headers: { "X-API-Key": "secret123" }
})
```

**Returns**:
```json
{
  "success": true,
  "endpoint": "/api/users",
  "method": "POST",
  "status": 201,
  "statusText": "Created",
  "data": { "id": 123, "name": "John" },
  "timing": 145.5,
  "cors": {
    "hasAccessControl": true,
    "allowOrigin": "*",
    "allowCredentials": "true"
  }
}
```

**When to use**:
- Testing API endpoints from the browser's perspective
- Debugging CORS issues
- Verifying API authentication works
- Measuring API response times
- Testing POST/PUT with different payloads

---

### 3. `test_form_validation`

**Purpose**: Test form validation and submission behavior.

**What it does for you**:
- Navigates to your form page
- Fills all specified fields automatically
- Clicks submit button
- Captures HTML5 validation messages
- Detects custom validation errors
- Checks for success messages
- Detects if form redirected after submit

**Parameters**:
- `url` (required): URL of the form page
- `formSelector` (required): CSS selector for the form
- `fields` (required): Object mapping field names to values
- `submitButtonSelector` (optional): Custom submit button selector

**Example**:
```javascript
test_form_validation({
  url: "http://localhost:3000/signup",
  formSelector: "#signup-form",
  fields: {
    email: "not-an-email",
    password: "123",
    confirmPassword: "456"
  }
})
```

**Returns**:
```json
{
  "success": true,
  "form": {
    "found": true,
    "submitted": true,
    "htmlValid": false
  },
  "validation": {
    "hasErrors": true,
    "errors": {
      "email": "Please enter a valid email address",
      "password": "Password must be at least 8 characters",
      "confirmPassword": "Passwords do not match"
    },
    "errorCount": 3
  },
  "result": {
    "redirected": false,
    "successMessage": null,
    "formStillVisible": true
  }
}
```

**When to use**:
- Testing form validation rules
- Verifying error messages appear correctly
- Testing successful form submission
- Checking form redirects after success
- Testing different invalid input combinations

---

### 4. `check_page_performance`

**Purpose**: Analyze page load performance and get optimization recommendations.

**What it does for you**:
- Measures all key performance metrics
- Analyzes resource loading by type (JS, CSS, images)
- Identifies slowest resources
- Checks Core Web Vitals (LCP, FID, CLS)
- Monitors memory usage
- Provides specific optimization recommendations
- Assigns a performance grade (A-D)

**Parameters**:
- `url` (required): URL to analyze
- `waitTime` (optional): Additional wait time in ms (default: 3000)

**Example**:
```javascript
check_page_performance({
  url: "http://localhost:3000/dashboard",
  waitTime: 5000
})
```

**Returns**:
```json
{
  "success": true,
  "performance": {
    "timing": {
      "domContentLoaded": 823,
      "loadComplete": 1456,
      "firstByte": 125
    },
    "resources": {
      "total": 47,
      "byType": {
        "js": { "count": 12, "size": 524288, "time": 450 },
        "css": { "count": 3, "size": 45678, "time": 120 },
        "image": { "count": 25, "size": 2456789, "time": 890 }
      },
      "slowest": [
        { "url": "vendor.js", "time": 234, "size": 345678 }
      ]
    },
    "memory": {
      "usedJSHeapSize": 23,
      "totalJSHeapSize": 45
    }
  },
  "recommendations": [
    "Large image payload - optimize images",
    "Too many JavaScript files - consider bundling"
  ],
  "summary": {
    "loadTime": "1456ms",
    "grade": "B"
  }
}
```

**When to use**:
- Measuring page load performance
- Finding performance bottlenecks
- Before/after optimization comparison
- Identifying slow resources
- Memory leak detection

---

### 5. `debug_javascript_error`

**Purpose**: Capture and analyze JavaScript errors with detailed debugging information.

**What it does for you**:
- Sets up comprehensive error capturing
- Captures both errors and unhandled promise rejections
- Triggers specific actions to reproduce errors
- Collects full stack traces
- Identifies error patterns
- Detects which framework is being used
- Provides specific fix suggestions

**Parameters**:
- `url` (required): URL where error occurs
- `triggerAction` (optional): JavaScript to trigger the error
- `waitBeforeTrigger` (optional): Wait time before trigger in ms

**Example**:
```javascript
debug_javascript_error({
  url: "http://localhost:3000/buggy-page",
  triggerAction: "document.getElementById('break-button').click()",
  waitBeforeTrigger: 2000
})
```

**Returns**:
```json
{
  "success": true,
  "errors": {
    "captured": [
      {
        "message": "Cannot read property 'name' of undefined",
        "source": "http://localhost:3000/main.js",
        "line": 145,
        "column": 23,
        "stack": "TypeError: Cannot read property...",
        "timestamp": 1699123456789
      }
    ],
    "total": 3
  },
  "analysis": {
    "errorTypes": {
      "undefined": 2,
      "typeError": 1
    },
    "affectedFiles": ["main.js", "utils.js"],
    "suggestions": [
      "Check for undefined variables or properties",
      "Verify data types and method availability"
    ]
  },
  "environment": {
    "framework": { "react": true, "vue": false },
    "debugging": { "hasSourceMaps": false, "strictMode": true }
  },
  "recommendations": [
    "Check for undefined variables or properties",
    "Enable source maps for better debugging"
  ]
}
```

**When to use**:
- Debugging production errors
- Reproducing user-reported bugs
- Analyzing error patterns
- Getting detailed stack traces
- Understanding error context

---

## How These Helpers Save Time

### Without Helpers (Multiple CDP Calls):
```javascript
// You would need to:
1. navigate_browser(url)
2. wait_for_element(selector)
3. execute_in_browser(fill_form_script)
4. click_element(submit)
5. get_browser_console()
6. execute_in_browser(check_errors_script)
7. execute_in_browser(check_success_script)
8. get_dom_snapshot()
// ... and piece together all the results
```

### With Helpers (Single Call):
```javascript
test_form_validation({
  url: "...",
  formSelector: "...",
  fields: { ... }
})
// Returns everything you need in one structured response
```

## Best Practices

1. **Use helpers first**: Before writing custom CDP scripts, check if a helper exists
2. **Check success field**: Always verify `success: true` in responses
3. **Read recommendations**: Helpers provide actionable suggestions
4. **Use appropriate waits**: Some helpers accept wait times for slow-loading pages
5. **Combine helpers**: Use multiple helpers together for comprehensive testing

## Common Patterns

### Pattern 1: Test New Feature
```
1. test_react_component() - Verify component renders
2. test_api_endpoint() - Check API works
3. test_form_validation() - Test user interactions
4. check_page_performance() - Ensure it's fast
```

### Pattern 2: Debug User Issue
```
1. debug_javascript_error() - Capture the error
2. test_api_endpoint() - Check if API is failing
3. test_react_component() - Verify component state
```

### Pattern 3: Performance Optimization
```
1. check_page_performance() - Baseline metrics
2. [Make optimizations]
3. check_page_performance() - Compare results
```

## Helper Selection Guide

| If you need to... | Use this helper |
|------------------|-----------------|
| Test if React component renders | `test_react_component` |
| Check API response and CORS | `test_api_endpoint` |
| Validate form inputs | `test_form_validation` |
| Measure page speed | `check_page_performance` |
| Debug JS errors | `debug_javascript_error` |
| Test login flow | `test_form_validation` |
| Check memory leaks | `check_page_performance` |
| Verify data loads | `test_api_endpoint` |
| Test error handling | `debug_javascript_error` |

## Summary

These helpers abstract away CDP complexity, allowing AI to:
- Test complete user flows with single commands
- Get structured, actionable results
- Receive specific recommendations
- Focus on fixing issues rather than writing test code

Each helper is designed to handle common edge cases, wait for appropriate conditions, and return comprehensive information that helps identify and fix issues quickly.