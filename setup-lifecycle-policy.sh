#!/bin/bash
# Container Registry Lifecycle Policy Setup
# Purpose: Auto-delete old Docker images to stay within 5GB Free Tier storage limit
#
# Google Cloud Free Tier includes:
# - 5GB of free Container Registry storage
# - Keeping only the last 5 images prevents storage bloat
#
# Usage: ./setup-lifecycle-policy.sh [PROJECT_ID]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID="${1:-$(gcloud config get-value project)}"

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: No PROJECT_ID specified and no default project configured${NC}"
  echo "Usage: ./setup-lifecycle-policy.sh [PROJECT_ID]"
  exit 1
fi

echo -e "${YELLOW}Setting up lifecycle policy for gcr.io/${PROJECT_ID}${NC}"

# Create lifecycle policy JSON
cat > /tmp/gcr-lifecycle-policy.json <<EOF
{
  "rules": [
    {
      "action": {
        "type": "Delete"
      },
      "condition": {
        "tagState": "any",
        "numNewerVersions": 5
      }
    },
    {
      "action": {
        "type": "Delete"
      },
      "condition": {
        "tagState": "untagged",
        "olderThan": "604800s"
      }
    }
  ]
}
EOF

echo -e "${YELLOW}Policy created:${NC}"
cat /tmp/gcr-lifecycle-policy.json

# Apply the lifecycle policy
echo -e "\n${YELLOW}Applying lifecycle policy to Container Registry...${NC}"

# For Google Container Registry (gcr.io)
gcloud container images add-tag-policy \
  gcr.io/${PROJECT_ID}/game \
  --policy-file=/tmp/gcr-lifecycle-policy.json \
  --project=${PROJECT_ID} 2>/dev/null || {
    # Fallback for Artifact Registry
    echo -e "${YELLOW}GCR command failed, trying Artifact Registry...${NC}"

    # Create the policy for Artifact Registry
    gcloud artifacts repositories set-cleanup-policies game \
      --location=us-central1 \
      --policy-file=/tmp/gcr-lifecycle-policy.json \
      --project=${PROJECT_ID}
}

# Cleanup
rm /tmp/gcr-lifecycle-policy.json

echo -e "${GREEN}✅ Lifecycle policy applied successfully!${NC}"
echo -e "${GREEN}This will keep only the last 5 images and delete untagged images older than 7 days${NC}"

# Show current storage usage
echo -e "\n${YELLOW}Current storage usage:${NC}"
gcloud container images list --project=${PROJECT_ID} 2>/dev/null || \
  gcloud artifacts docker images list us-central1-docker.pkg.dev/${PROJECT_ID}/game --project=${PROJECT_ID}

echo -e "\n${GREEN}Done! Your Container Registry will now auto-cleanup old images.${NC}"
