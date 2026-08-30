#!/bin/bash
# .agents/tools/run_strict_checks.sh
# Runs Strict Verification Gate for tournament_manager_next

echo "Running Strict Verification Gate..."

# 1. Linting
echo "Linting..."
npm run lint || { echo "Linting failed."; exit 1; }

# 2. Node Native Tests
echo "Running Pure Logic Tests..."
npm test || { echo "Tests failed."; exit 1; }

# 3. Next.js Build
echo "Testing Next.js Build..."
npm run build || { echo "Next.js Build failed."; exit 1; }

# 4. Doc Claims Check
echo "Checking Doc Claims..."
npm run check:claims || { echo "Doc claims check failed."; exit 1; }

echo "Verification Passed. Safe to commit."

