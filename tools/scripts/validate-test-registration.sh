#!/bin/bash
# Validates that all test packages are registered in the Swift deployer QA UI
# Run this as part of CI or before committing test changes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SETTINGS_VIEW="$PROJECT_ROOT/apps/swift-deployer/Sources/RadiantDeployer/Views/SettingsView.swift"

echo "🔍 Validating test registration in QA UI..."
echo ""

ERRORS=0

# Check each package with tests
check_package() {
    local package_path="$1"
    local package_name="$2"
    local expected_case="$3"
    
    # Check if package has tests
    if [ -d "$PROJECT_ROOT/$package_path/__tests__" ] || [ -d "$PROJECT_ROOT/$package_path/tests" ]; then
        # Check if package.json has test script
        if [ -f "$PROJECT_ROOT/$package_path/package.json" ]; then
            if ! grep -q '"test"' "$PROJECT_ROOT/$package_path/package.json"; then
                echo "❌ $package_name: Missing 'test' script in package.json"
                ERRORS=$((ERRORS + 1))
            fi
        fi
        
        # Check if registered in Swift deployer
        if ! grep -q "$expected_case" "$SETTINGS_VIEW"; then
            echo "❌ $package_name: Not registered in UnitTestSuite enum"
            echo "   Add 'case $expected_case' to UnitTestSuite in SettingsView.swift"
            ERRORS=$((ERRORS + 1))
        else
            echo "✅ $package_name: Registered in QA UI"
        fi
    fi
}

# Validate known packages
check_package "apps/admin-dashboard" "Admin Dashboard" "adminDashboard"
check_package "packages/infrastructure" "Infrastructure" "infrastructure"
check_package "packages/shared" "Shared Package" "shared"

# Check for any new packages with tests that might not be registered
echo ""
echo "🔍 Scanning for unregistered test packages..."

find "$PROJECT_ROOT/apps" "$PROJECT_ROOT/packages" -name "__tests__" -type d 2>/dev/null | while read -r test_dir; do
    package_dir=$(dirname "$test_dir")
    package_name=$(basename "$package_dir")
    
    # Skip node_modules
    if [[ "$test_dir" == *"node_modules"* ]]; then
        continue
    fi
    
    # Check if this package is mentioned in the Swift file
    if ! grep -qi "$package_name" "$SETTINGS_VIEW"; then
        echo "⚠️  Found tests in $package_dir but not explicitly registered in QA UI"
    fi
done

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All test packages are properly registered!"
    exit 0
else
    echo "❌ Found $ERRORS registration issue(s)"
    echo ""
    echo "To fix, update apps/swift-deployer/Sources/RadiantDeployer/Views/SettingsView.swift:"
    echo "1. Add case to UnitTestSuite enum"
    echo "2. Add icon in suiteIcon(for:)"
    echo "3. Add description in suiteDescription(for:)"
    echo "4. Add command in testCommand(for:projectRoot:)"
    echo ""
    echo "See: .windsurf/workflows/add-unit-tests.md"
    exit 1
fi
