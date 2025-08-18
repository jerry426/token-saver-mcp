#!/bin/bash

# Test script for MCP Dashboard
# This script sends multiple concurrent requests to test the dashboard metrics

PORT=${1:-9527}
BASE_URL="http://127.0.0.1:$PORT"

echo "Testing MCP Dashboard on port $PORT"
echo "Dashboard URL: $BASE_URL/dashboard"
echo ""

# First, initialize the MCP server
echo "Initializing MCP server..."
curl -s -X POST $BASE_URL/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "capabilities": {}
    },
    "id": 1
  }' > /dev/null

echo "Server initialized. Starting test requests..."
echo ""

# Function to make a search_text request
make_search_request() {
  local query=$1
  local id=$2
  curl -s -X POST $BASE_URL/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"search_text\",
        \"arguments\": {
          \"query\": \"$query\"
        }
      },
      \"id\": $id
    }" > /dev/null 2>&1 &
}

# Function to make a get_hover request
make_hover_request() {
  local id=$1
  curl -s -X POST $BASE_URL/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"get_hover\",
        \"arguments\": {
          \"uri\": \"file:///Users/jerry/VSCode/token-saver-mcp/src/index.ts\",
          \"line\": 10,
          \"character\": 5
        }
      },
      \"id\": $id
    }" > /dev/null 2>&1 &
}

# Function to make a get_definition request
make_definition_request() {
  local id=$1
  curl -s -X POST $BASE_URL/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"get_definition\",
        \"arguments\": {
          \"uri\": \"file:///Users/jerry/VSCode/token-saver-mcp/src/mcp/tools.ts\",
          \"line\": 50,
          \"character\": 10
        }
      },
      \"id\": $id
    }" > /dev/null 2>&1 &
}

echo "Sending 30 concurrent requests..."
echo "  - 10 search_text requests"
echo "  - 10 get_hover requests"
echo "  - 10 get_definition requests"
echo ""

# Send multiple concurrent requests
for i in {1..10}; do
  make_search_request "function" $((100 + i))
  make_hover_request $((200 + i))
  make_definition_request $((300 + i))
done

# Wait for all background jobs to complete
wait

echo ""
echo "All requests completed!"
echo ""
echo "Check the dashboard at: $BASE_URL/dashboard"
echo "Metrics endpoint: $BASE_URL/metrics"
echo ""

# Fetch and display current metrics
echo "Current metrics:"
curl -s $BASE_URL/metrics | python3 -m json.tool | head -20