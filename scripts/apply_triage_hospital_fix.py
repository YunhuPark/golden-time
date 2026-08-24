from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"pattern not found in {path}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# 1) URL context: secondary condition support + remove generic RED surgery filter.
replace_once(
    "src/presentation/pages/HomePage.tsx",
    "      primaryCondition: conditionStr,\n      analysisMode: analysisMode,",
    "      primaryCondition: conditionStr,\n      secondaryConditions: parseArrayParam('secondaryConditions'),\n      analysisMode: analysisMode,",
)

replace_once(
    "src/presentation/pages/HomePage.tsx",
    "      // RED 응급도일 경우 자동 필터링 적용\n      if (triage === 'RED') {\n        // 기존 상태가 초기화되기 전에 약간의 지연 후 필터 적용\n        setTimeout(() => {\n          const store = useAppStore.getState();\n          store.setFilters({\n            ...store.filters,\n            hasAvailableBeds: true,\n            hasSurgery: true, // 수술 가능 병원 우선\n          });\n        }, 100);\n      }",
    "      // 질환별 요구 역량은 HospitalAICardService/RankingService에서 반영합니다.\n      // RED라고 해서 모든 질환에 수술 가능 필터를 강제하지 않습니다.",
)

# 2) Do not flash the preliminary ranking before route-time enrichment.
replace_once(
    "src/presentation/pages/HomePage.tsx",
    "        setHospitals(result.hospitals, result.warning);\n\n        // 초기 로드 완료 (직선거리 및 AI 기반 1차 랭킹)\n        console.log(`✅ Loaded ${result.hospitals.length} hospitals from API`);",
    "        // 초기 랭킹은 화면에 바로 노출하지 않습니다.\n        // 상위 후보의 실제 경로시간 계산 후 최종 랭킹을 한 번만 표시합니다.\n        console.log(`✅ Loaded ${result.hospitals.length} hospitals from API; final ranking pending route info`);",
)

replace_once(
    "src/presentation/pages/HomePage.tsx",
    "            console.error('Failed to calculate routes in background:', routeErr);\n            if (!isCancelled && searchRequestIdRef.current === currentReqId) {",
    "            console.error('Failed to calculate routes in background:', routeErr);\n            if (!isCancelled && searchRequestIdRef.current === currentReqId) {\n              // 경로 계산 실패 시에만 1차 랭킹을 fallback으로 표시합니다.\n              setHospitals(result.hospitals, result.warning);",
)

# 3) Only show recommendation badges for meaningful capability matches.
replace_once(
    "src/presentation/components/hospital/HospitalCard.tsx",
    "  const isAiRecommended = aiMatch && aiMatch.score > 0;",
    "  const isAiRecommended = Boolean(\n    aiMatch && aiMatch.maxScore > 0 && aiMatch.score / aiMatch.maxScore >= 0.66\n  );",
)

replace_once(
    "src/presentation/components/hospital/HospitalCard.tsx",
    "{aiContext.triage === 'RED' ? '🚨 긴급 이송 거점' : aiContext.triage === 'YELLOW' ? '⚠️ 집중 모니터링' : '💡 요구 역량 매칭'}",
    "{aiContext.triage === 'RED' ? '🚨 RED 우선 이송 후보' : aiContext.triage === 'YELLOW' ? '⚠️ 집중 모니터링 후보' : '💡 요구 역량 매칭'}",
)

replace_once(
    "src/presentation/components/hospital/HospitalCard.tsx",
    "          {styles.label}\n",
    "          추정 {styles.label}\n",
)

# 4) Do not mark every hospital as emergency-medicine capable by default.
replace_once(
    "src/data/models/mappers/HospitalMapper.ts",
    "    // 기본값: 응급의학과는 항상 포함\n    if (!specializations.includes('응급의학과')) {\n      specializations.push('응급의학과');\n    }\n\n    return specializations;",
    "    // 확인되지 않은 진료과를 기본값으로 추가하지 않습니다.\n    // AI 매칭은 실제 응답에서 파싱된 진료과만 근거로 사용합니다.\n    return specializations;",
)

print("Golden-Time triage/hospital UX patches applied.")
