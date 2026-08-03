"""어댑터 레지스트리 — 규약 기반 자동 발견 (REQ-6).

규약은 단 하나다::

    services/crawler/adapters/<source_id>/adapter.py   →   ADAPTER 또는 build_adapter()

이 파일 하나를 추가하면 등록이 끝난다. `core/` 도, `pyproject.toml` 도, 다른 어댑터
디렉터리도 건드리지 않는다. entry-point 방식(`[project.entry-points]`)을 쓰지 않는 이유는,
entry-point 는 **어댑터 태스크가 `pyproject.toml` 을 편집해야만** 등록되기 때문이다.
C2·C3 계약이 `pyproject.toml` 을 touches 밖으로 명시하고 있으므로 그 방식은 애초에
성립하지 않는다 (C3.md §2: "공용 파일(core/**, pyproject.toml)은
어떤 파생 태스크도 수정하지 않는다").

approved=false 인 소스의 어댑터는 **로드되지 않는다.** D3 가 forbidden 으로 판정한 소스에
어댑터 파일이 들어와도 레지스트리가 집어 들지 않아야, "코드는 있는데 안 쓴다"는 상태가
"실수로 켜졌다"로 바뀌는 경로가 막힌다.
"""

from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path

from .allowlist import Allowlist, load_allowlist
from .contracts.adapter import SourceAdapter, adapter_id_of, adapter_version_of
from .d3 import repo_root
from .errors import AdapterContractError, AdapterNotRegisteredError

#: 리포 기준 어댑터 루트. CI 가드 잡의 글롭(`services/crawler/adapters/*`)과 같은 값이다.
ADAPTERS_ROOT = "services/crawler/adapters"

#: 규약 파일명
ADAPTER_MODULE_FILENAME = "adapter.py"

#: 모듈이 노출해야 하는 심볼 (둘 중 하나)
ADAPTER_ATTR = "ADAPTER"
ADAPTER_FACTORY = "build_adapter"


@dataclass(frozen=True, slots=True)
class DiscoveredAdapter:
    source_id: str
    module_path: Path
    adapter: SourceAdapter
    approved: bool
    verdict: str


def _load_module(source_id: str, module_path: Path):
    mod_name = f"glowmate_adapters.{source_id}"
    spec = importlib.util.spec_from_file_location(mod_name, module_path)
    if spec is None or spec.loader is None:
        raise AdapterContractError(f"어댑터 모듈을 로드할 수 없다: {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    spec.loader.exec_module(module)
    return module


def _instantiate(source_id: str, module_path: Path) -> SourceAdapter:
    module = _load_module(source_id, module_path)
    if hasattr(module, ADAPTER_ATTR):
        adapter = getattr(module, ADAPTER_ATTR)
    elif hasattr(module, ADAPTER_FACTORY):
        adapter = getattr(module, ADAPTER_FACTORY)()
    else:
        raise AdapterContractError(
            f"{module_path} 에 `{ADAPTER_ATTR}` 도 `{ADAPTER_FACTORY}()` 도 없다 — "
            "규약을 만족하지 않는 어댑터는 등록되지 않는다"
        )
    declared = adapter_id_of(adapter)
    if declared != source_id:
        raise AdapterContractError(
            f"어댑터의 source_id({declared!r})가 디렉터리 이름({source_id!r})과 다르다 — "
            "디렉터리가 곧 등록 키다"
        )
    adapter_version_of(adapter)  # 부재 시 예외
    return adapter


class AdapterRegistry:
    """어댑터 자동 발견 결과."""

    def __init__(self, adapters: dict[str, DiscoveredAdapter], adapters_root: Path) -> None:
        self._adapters = adapters
        self.adapters_root = adapters_root

    @property
    def source_ids(self) -> tuple[str, ...]:
        """**로드된**(approved=true) 어댑터의 소스 ID."""
        return tuple(sorted(sid for sid, d in self._adapters.items() if d.approved))

    @property
    def rejected(self) -> dict[str, str]:
        """approved=false 라서 로드하지 않은 어댑터 → 사유."""
        return {
            sid: f"verdict={d.verdict} · approved=false"
            for sid, d in self._adapters.items()
            if not d.approved
        }

    def get(self, source_id: str) -> SourceAdapter:
        found = self._adapters.get(source_id)
        if found is None:
            raise AdapterNotRegisteredError(
                f"미등록 source_id: {source_id!r} "
                f"(등록됨: {', '.join(self.source_ids) or '없음'})"
            )
        if not found.approved:
            raise AdapterNotRegisteredError(
                f"{source_id!r} 은 allowlist 에서 approved=false 다 (verdict={found.verdict}) — "
                "레지스트리는 승인되지 않은 소스의 어댑터를 내주지 않는다"
            )
        return found.adapter

    def __contains__(self, source_id: object) -> bool:
        found = self._adapters.get(str(source_id))
        return found is not None and found.approved

    def __len__(self) -> int:
        return len(self.source_ids)


def discover_adapters(
    adapters_root: str | Path | None = None,
    allowlist: Allowlist | None = None,
    root: Path | None = None,
) -> AdapterRegistry:
    """규약 디렉터리를 훑어 어댑터를 등록한다.

    디렉터리가 없거나 어댑터가 0건인 것은 **오류가 아니다** — G3 판정상 현재
    승인된 어댑터 대상은 official_website 1개뿐이고, C2·C3 는 보류 상태다.
    대신 `len(registry) == 0` 을 "정상"으로 소비하는 코드가 없도록,
    스모크 러너는 어댑터 0건이면 실패한다.
    """
    base = repo_root(root)
    adir = Path(adapters_root) if adapters_root is not None else base / ADAPTERS_ROOT
    al = allowlist if allowlist is not None else load_allowlist(root=root)

    found: dict[str, DiscoveredAdapter] = {}
    if adir.is_dir():
        for child in sorted(adir.iterdir()):
            if not child.is_dir() or child.name.startswith((".", "_")):
                continue
            module_path = child / ADAPTER_MODULE_FILENAME
            if not module_path.is_file():
                continue
            source_id = child.name
            policy = al.get(source_id)
            approved = bool(policy and policy.approved)
            verdict = policy.verdict if policy else "미등재"
            if not approved:
                # 승인되지 않은 소스는 **모듈 실행조차 하지 않는다.**
                # import 부작용만으로 요청이 나가는 코드를 막기 위해서다.
                found[source_id] = DiscoveredAdapter(
                    source_id=source_id,
                    module_path=module_path,
                    adapter=None,  # type: ignore[arg-type]
                    approved=False,
                    verdict=verdict,
                )
                continue
            found[source_id] = DiscoveredAdapter(
                source_id=source_id,
                module_path=module_path,
                adapter=_instantiate(source_id, module_path),
                approved=True,
                verdict=verdict,
            )
    return AdapterRegistry(found, adir)
