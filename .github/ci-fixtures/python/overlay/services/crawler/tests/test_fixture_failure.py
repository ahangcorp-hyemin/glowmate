"""위반 재현용: 반드시 실패하는 테스트 (REQ-4 python job)."""


def test_fixture_must_fail() -> None:
    extracted = ""
    assert extracted == "글로우메이트 성수점", "추출 결과가 비어 있다 — 조용한 실패를 통과시키면 안 된다"
