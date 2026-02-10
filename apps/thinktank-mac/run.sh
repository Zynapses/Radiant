#!/bin/bash
cd "$(dirname "$0")"
pkill -f ThinkTankMac 2>/dev/null
swift build 2>&1 && .build/arm64-apple-macosx/debug/ThinkTankMac
