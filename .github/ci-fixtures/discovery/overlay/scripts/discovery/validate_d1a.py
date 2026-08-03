#!/usr/bin/env python3
"""위반 재현용: 인자·입력과 무관하게 항상 exit 0 인 스텁 검증기 (FORBID-6 (b))."""
import sys

def main() -> int:
    # 아무것도 검증하지 않는다. 이것이 discovery job 을 영구 초록으로 만드는 형태다.
    return 0

if __name__ == "__main__":
    sys.exit(main())
