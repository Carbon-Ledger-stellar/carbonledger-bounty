#!/usr/bin/env python3
"""
GitHub Issues Batch Creator for CarbonLedger
Creates 50 GitHub issues from the issues batch file.
"""

import os
import sys
import json
import re
from typing import Dict, List
import requests

# GitHub API configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO", "carbon-ledger-stellar/carbonledger-bounty")
GITHUB_API_URL = "https://api.github.com"

def parse_issues_from_file(filepath: str) -> List[Dict]:
    """Parse GitHub issues from markdown file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    issues = []
    
    # Split by issue headers (### Issue N:)
    issue_pattern = r'### Issue \d+: (.+?)\n\*\*Labels:\*\* `([^`]+)`(?:, `([^`]+)`)*\n\*\*Priority:\*\* (\w+)\n\n(.+?)(?=### Issue \d+:|## |$)'
    
    matches = re.finditer(issue_pattern, content, re.DOTALL)
    
    for match in matches:
        title = match.group(1).strip()
        labels_str = match.group(2)
        priority = match.group(4)
        body = match.group(5).strip()
        
        # Parse labels - handle multiple labels in backticks
        labels = []
        label_pattern = r'`([^`]+)`'
        label_matches = re.finditer(label_pattern, match.group(0)[:200])
        for label_match in label_matches:
            labels.append(label_match.group(1))
        
        # Extract overview, proposed change, acceptance criteria
        issue_data = {
            'title': title,
            'labels': labels,
            'priority': priority,
            'body': body
        }
        
        issues.append(issue_data)
    
    return issues

def create_github_issue(issue: Dict) -> bool:
    """Create a single GitHub issue via API."""
    if not GITHUB_TOKEN:
        print("ERROR: GITHUB_TOKEN environment variable not set")
        return False
    
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }
    
    # Prepare issue data
    issue_data = {
        "title": issue['title'],
        "body": issue['body'],
        "labels": issue['labels']
    }
    
    url = f"{GITHUB_API_URL}/repos/{GITHUB_REPO}/issues"
    
    try:
        response = requests.post(url, headers=headers, json=issue_data, timeout=10)
        
        if response.status_code == 201:
            issue_number = response.json()['number']
            print(f"✓ Created issue #{issue_number}: {issue['title']}")
            return True
        elif response.status_code == 422:
            print(f"⚠ Skipped (may already exist): {issue['title']}")
            return True
        else:
            print(f"✗ Failed to create issue: {issue['title']}")
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    
    except requests.exceptions.RequestException as e:
        print(f"✗ Network error creating issue: {issue['title']}")
        print(f"  Error: {e}")
        return False

def create_all_issues(filepath: str) -> None:
    """Create all issues from the batch file."""
    print(f"Parsing issues from {filepath}...")
    issues = parse_issues_from_file(filepath)
    print(f"Found {len(issues)} issues\n")
    
    if not issues:
        print("No issues found in file!")
        return
    
    print(f"GitHub Repo: {GITHUB_REPO}")
    print("=" * 60)
    
    successful = 0
    failed = 0
    
    for i, issue in enumerate(issues, 1):
        print(f"[{i}/{len(issues)}] Creating: {issue['title']}")
        
        if create_github_issue(issue):
            successful += 1
        else:
            failed += 1
        
        # Rate limiting: 2 second delay between requests (GitHub allows ~5000/hour)
        import time
        time.sleep(0.5)
    
    print("\n" + "=" * 60)
    print(f"Summary:")
    print(f"  Successful: {successful}")
    print(f"  Failed: {failed}")
    print(f"  Total: {len(issues)}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    else:
        filepath = "GITHUB_ISSUES_BATCH.md"
    
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        sys.exit(1)
    
    create_all_issues(filepath)
