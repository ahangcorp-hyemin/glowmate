# [FIXTURE] 토큰 추출 경로

<!-- DS0-EXTRACT-CMD-BEGIN -->
```bash
# 합성 픽스처용 추출 커맨드 (example-ds/css @ 1.0.0 → extracted_tokens.json)
node --input-type=module <<'NODE'
import { writeFileSync } from "node:fs";
const PKG = "example-ds/css";
const VERSION = "1.0.0";
const OUT = "extracted_tokens.json";
const tokens = Array.from({ length: 60 }, (_, i) => ({
  original_key: `--fx-token-${String(i + 1).padStart(3, "0")}`,
  original_value: `#${String(i + 1).padStart(6, "0")}`,
  selector: ":root",
  source_line: i + 1,
}));
writeFileSync(OUT, JSON.stringify({ $meta: { source_package: PKG, source_version: VERSION, output_path: OUT, leaf_count: tokens.length }, tokens }, null, 2) + "\n");
NODE
```
<!-- DS0-EXTRACT-CMD-END -->
