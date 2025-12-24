#!/bin/bash

# Split RADIANT prompt into sections
INPUT="$1"
OUTPUT_DIR="docs/sections"

mkdir -p "$OUTPUT_DIR"

# Extract each section based on line numbers
# Section 0: lines 691-2183
sed -n '691,2183p' "$INPUT" > "$OUTPUT_DIR/section-00-shared-types.md"

# Section 1: lines 2184-4835
sed -n '2184,4835p' "$INPUT" > "$OUTPUT_DIR/section-01-swift-app.md"

# Section 2: lines 4836-7526
sed -n '4836,7526p' "$INPUT" > "$OUTPUT_DIR/section-02-cdk-base.md"

# Section 3: lines 7527-10422
sed -n '7527,10422p' "$INPUT" > "$OUTPUT_DIR/section-03-cdk-ai-api.md"

# Section 4: lines 10423-14346
sed -n '10423,14346p' "$INPUT" > "$OUTPUT_DIR/section-04-lambda-core.md"

# Section 5: lines 14347-16016
sed -n '14347,16016p' "$INPUT" > "$OUTPUT_DIR/section-05-lambda-admin.md"

# Section 6: lines 16017-17585
sed -n '16017,17585p' "$INPUT" > "$OUTPUT_DIR/section-06-self-hosted.md"

# Section 7: lines 17586-23058
sed -n '17586,23058p' "$INPUT" > "$OUTPUT_DIR/section-07-database.md"

# Section 8: lines 23059-27285
sed -n '23059,27285p' "$INPUT" > "$OUTPUT_DIR/section-08-admin-dashboard.md"

# Section 9: lines 27286-28214
sed -n '27286,28214p' "$INPUT" > "$OUTPUT_DIR/section-09-deployment.md"

# Sections 10-17 (smaller, AI features)
sed -n '28215,28444p' "$INPUT" > "$OUTPUT_DIR/section-10-visual-ai.md"
sed -n '28445,28726p' "$INPUT" > "$OUTPUT_DIR/section-11-brain.md"
sed -n '28727,28884p' "$INPUT" > "$OUTPUT_DIR/section-12-analytics.md"
sed -n '28885,29116p' "$INPUT" > "$OUTPUT_DIR/section-13-neural-engine.md"
sed -n '29117,29317p' "$INPUT" > "$OUTPUT_DIR/section-14-error-logging.md"
sed -n '29318,29538p' "$INPUT" > "$OUTPUT_DIR/section-15-credentials.md"
sed -n '29539,29624p' "$INPUT" > "$OUTPUT_DIR/section-16-aws-admin.md"
sed -n '29625,29762p' "$INPUT" > "$OUTPUT_DIR/section-17-auto-resolve.md"

# Sections 18-28 (Consumer platform)
sed -n '29763,30063p' "$INPUT" > "$OUTPUT_DIR/section-18-think-tank.md"
sed -n '30064,30519p' "$INPUT" > "$OUTPUT_DIR/section-19-concurrent-chat.md"
sed -n '30520,30693p' "$INPUT" > "$OUTPUT_DIR/section-20-collaboration.md"
sed -n '30694,30916p' "$INPUT" > "$OUTPUT_DIR/section-21-voice-video.md"
sed -n '30917,31117p' "$INPUT" > "$OUTPUT_DIR/section-22-memory.md"
sed -n '31118,31326p' "$INPUT" > "$OUTPUT_DIR/section-23-canvas.md"
sed -n '31327,31559p' "$INPUT" > "$OUTPUT_DIR/section-24-merging.md"
sed -n '31560,31773p' "$INPUT" > "$OUTPUT_DIR/section-25-focus-modes.md"
sed -n '31774,32020p' "$INPUT" > "$OUTPUT_DIR/section-26-scheduled.md"
sed -n '32021,32271p' "$INPUT" > "$OUTPUT_DIR/section-27-family-teams.md"
sed -n '32272,32469p' "$INPUT" > "$OUTPUT_DIR/section-28-analytics-int.md"

# Sections 29-35 (Advanced features)
sed -n '32470,32899p' "$INPUT" > "$OUTPUT_DIR/section-29-dashboard-ext.md"
sed -n '32900,33442p' "$INPUT" > "$OUTPUT_DIR/section-30-provider-registry.md"
sed -n '33443,35414p' "$INPUT" > "$OUTPUT_DIR/section-31-model-pricing.md"
sed -n '35415,37298p' "$INPUT" > "$OUTPUT_DIR/section-32-time-machine-db.md"
sed -n '37299,38620p' "$INPUT" > "$OUTPUT_DIR/section-33-time-machine-ui.md"
sed -n '38621,39304p' "$INPUT" > "$OUTPUT_DIR/section-34-orchestration.md"
sed -n '39305,39645p' "$INPUT" > "$OUTPUT_DIR/section-35-model-mgmt-ui.md"

# Sections 36-39 (Intelligence layer)
sed -n '39646,41040p' "$INPUT" > "$OUTPUT_DIR/section-36-model-registry.md"
sed -n '41041,42168p' "$INPUT" > "$OUTPUT_DIR/section-37-feedback.md"
sed -n '42169,43063p' "$INPUT" > "$OUTPUT_DIR/section-38-neural-orchestration.md"
sed -n '43064,47659p' "$INPUT" > "$OUTPUT_DIR/section-39-workflow-proposal.md"

# Sections 40-42 (Platform hardening)
sed -n '47660,49484p' "$INPUT" > "$OUTPUT_DIR/section-40-data-isolation.md"
sed -n '49485,52653p' "$INPUT" > "$OUTPUT_DIR/section-41-i18n.md"
sed -n '52654,54836p' "$INPUT" > "$OUTPUT_DIR/section-42-config-mgmt.md"

# Sections 43-46 (Billing)
sed -n '54837,56016p' "$INPUT" > "$OUTPUT_DIR/section-43-billing.md"
sed -n '56017,56229p' "$INPUT" > "$OUTPUT_DIR/section-44-storage-billing.md"
sed -n '56230,56521p' "$INPUT" > "$OUTPUT_DIR/section-45-subscriptions.md"
sed -n '56522,56889p' "$INPUT" > "$OUTPUT_DIR/section-46-dual-admin.md"

echo "Split complete. Created $(ls -1 $OUTPUT_DIR | wc -l) section files."
