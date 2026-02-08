#!/bin/bash
# Build comprehensive RADIANT documentation

cd /Users/robertlong/CascadeProjects/Radiant/docs/publications

# Combine all existing markdown files with the visual HTML
echo "Combining documentation..."

# Convert existing detailed markdown to HTML sections using pandoc
pandoc 06-SERVICES-REFERENCE.md -o services.html --standalone 2>/dev/null || true
pandoc 07-DATABASE-SCHEMA.md -o database.html --standalone 2>/dev/null || true  
pandoc 08-SWIFT-DEPLOYER.md -o swift.html --standalone 2>/dev/null || true
pandoc 09-ADMIN-DASHBOARD.md -o dashboard.html --standalone 2>/dev/null || true

echo "Done preparing sections"
