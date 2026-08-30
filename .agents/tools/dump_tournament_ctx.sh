#!/bin/bash
# .agents/tools/dump_tournament_ctx.sh
# Dumps critical context for AI agents

OUTPUT_FILE=".agents/context_dump.md"

echo "# Tournament Manager Next Context" > "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 1. Global AI Rules (AGENTS.md)" >> "$OUTPUT_FILE"
echo '```markdown' >> "$OUTPUT_FILE"
cat AGENTS.md >> "$OUTPUT_FILE" 2>/dev/null || echo "AGENTS.md not found" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 2. High-Fidelity Domain Reference (README.md)" >> "$OUTPUT_FILE"
echo '```markdown' >> "$OUTPUT_FILE"
cat README.md >> "$OUTPUT_FILE" 2>/dev/null || echo "README.md not found" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 3. Tournament Model (src/models/Tournament.js)" >> "$OUTPUT_FILE"
echo '```javascript' >> "$OUTPUT_FILE"
cat src/models/Tournament.js >> "$OUTPUT_FILE" 2>/dev/null || echo "src/models/Tournament.js not found" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "Context dumped successfully to $OUTPUT_FILE"
