from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"pattern not found in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/presentation/pages/HomePage.tsx",
    "        // 백그라운드 경로 계산 비동기 실행 (await 하지 않음)\n        (async () => {",
    "        // 최종 후보가 확정될 때까지 로딩 상태를 유지해 중간 순위가 깜빡이지 않게 합니다.\n        await (async () => {",
)

replace_once(
    "src/presentation/components/hospital/HospitalCard.tsx",
    "            {' '} - {getConditionName(aiContext.primaryCondition)} (확인 조건 {aiMatch.matchedReasons.length}개)",
    "            {' '} - {(aiContext.secondaryConditions?.length ?? 0) > 0 ? '복합 응급 대응' : getConditionName(aiContext.primaryCondition)} (확인 조건 {aiMatch.matchedReasons.length}개)",
)

print("Final triage UX fixes applied.")
