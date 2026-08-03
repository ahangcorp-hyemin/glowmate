"""위반 재현용: 반드시 실패하는 테스트 (REQ-4 python job).

이 파일은 **ruff 를 통과하고 pytest 에서만 실패해야 한다.**
줄 길이(ruff line-length = 100)를 넘기면 ruff 단계에서 죽어, 픽스처가 증명하는 것이
pytest 가 아니라 ruff 가 되어버린다 — 실제로 그 상태였고 PR 검수에서 지적됐다.
"""

EXPECTED = "글로우메이트 성수점"


def test_fixture_must_fail() -> None:
    extracted = ""
    # 조용한 실패(빈 결과를 정상으로 통과시키는 것)를 재현한다.
    assert extracted == EXPECTED, "추출 결과가 비어 있다"
