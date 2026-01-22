#!/bin/bash

# Configuration
CONFIG_FILE="/Users/apple/.gemini/antigravity/mcp_config.json"

# 1. Get a fresh access token from gcloud
echo "Obtaining fresh access token from gcloud..."
NEW_TOKEN=$(gcloud auth application-default print-access-token)

if [ -z "$NEW_TOKEN" ]; then
  echo "Error: Failed to obtain access token. Make sure you are logged in to gcloud."
  exit 1
fi

# 2. Update the Authorization header in mcp_config.json using sed
# We look for the "stitch" section and update its "Authorization" value.
# Note: macOS sed needs an empty string for the -i flag or no extension.
echo "Updating $CONFIG_FILE..."
sed -i '' "s|\"Authorization\": \"Bearer .*\"|\"Authorization\": \"Bearer $NEW_TOKEN\"|g" "$CONFIG_FILE"

echo "Done! Token refreshed successfully."
echo "Please restart your IDE (e.g., Cursor) to ensure the changes are picked up by the MCP client."
