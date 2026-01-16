# Project Development Guidelines & User Policy

이 문서는 **사용자(User)와 AI(Cortex)**가 이 프로젝트를 진행함에 있어 반드시 지켜야 할 **핵심 원칙(Core Principles)**과 **작업 가이드라인**을 정의합니다.
AI는 모든 답변과 코드 작성 시 이 문서를 최우선 기준으로 삼아야 합니다.

---

## 0. 🚦 Work Process Policy (작업 절차 원칙)
**"무엇을 하든 문서화 작업을 거치고 승인 받은 후 진행한다."**

*   **Documentation First (No Exception)**: 모든 작업(새 기능, 버그 수정, 리팩토링 등)은 코드를 작성하기 전 반드시 **계획서나 분석서**를 작성해야 합니다.
    *   **새로운 기능**: `implementation_plan.md` (구현 계획서)
    *   **버그 수정**: `bug_report.md` 또는 `analysis_report.md` (원인 분석 및 해결 방안)
    *   **단순 수정**: 최소한 `issue_summary.md` (변경 사유 및 영향 범위)
*   **Approval Required**: 작성된 문서를 사용자에게 제시하고, **명시적인 컨펌(Confirm)**을 받은 후에만 IDE 수정(Coding) 단계로 진입해야 합니다. **예외는 없습니다.**

## 1. 🎨 UI/UX Preservation Policy (디자인 보존 원칙)
**"기존 디자인은 사용자의 명시적 허락 없이 1px도 변경하지 않는다."**

*   **Regression Zero**: 새로운 기능을 추가할 때, 기존 컴포넌트의 레이아웃, 색상, 패딩, 폰트 스타일을 **100% 유지**해야 합니다.
*   **Legacy Style**: 사용자가 "이전 스타일로 되돌려줘"라고 하면 즉시 복구해야 합니다. (예: 화려한 Emerald 테마보다 기존 Gray 테마 선호 시 즉시 반영)
*   **Component Reuse**: 새로운 UI가 필요할 경우, 반드시 `components/ui/` 폴더의 기존 버튼, 카드, 인풋 컴포넌트를 재사용하여 이질감을 없애야 합니다.

## 2. 🛡 Logical Integrity & Defensive Coding (논리적 완결성)
**"데이터가 없는 최악의 상황(Worst Case)을 먼저 고려한다."**

*   **No Hardcoding**: `Category.TRANSFER`와 같이 특정 값에 의존하는 하드코딩은 금지됩니다. 반드시 DB나 `types.ts`의 실제 데이터를 조회하여 동적으로 처리해야 합니다.
*   **Null Safety**: `category`가 `undefined`이거나, `assets` 배열이 비어있는 경우를 항상 가정하고 이에 대한 **Fallback 로직(기본값 처리)**을 코드에 포함해야 합니다.
*   **Environment Check**: 코드를 제안하기 전, 해당 파일(`types.ts` 등)에 필요한 타입이나 인터페이스가 실제로 존재하는지 먼저 확인(`view_file`, `grep_search`)해야 합니다.

## 3. 🧪 Simulation & Verification Strategy (시뮬레이션 검증)
**"구체적인 시나리오로 검증한다."**

*   **Scenario First**: 복잡한 로직(예: 자동 감지, 이체 매칭)을 구현할 때는, 코드 작성 전 **"5가지 시나리오 보고서"**를 작성하여 사용자에게 로직의 타당성을 먼저 승인받아야 합니다.
*   **Concrete Examples**: "잘 작동할 것입니다"라는 추상적인 표현 대신, **"A상황에서는 B가 출력됩니다"**라는 구체적인 입출력 예시를 제시해야 합니다.

## 4. 📝 Communication Style (커뮤니케이션)
**"일반론이 아닌, 내 프로젝트의 맥락(Context)에서 말한다."**

*   **Specific Evidence**: 답변 시 "파일 경로", "실제 파일 크기", "관련된 컴포넌트 이름"을 구체적으로 언급하여 AI가 **현재 프로젝트를 정확히 이해하고 있음**을 증명해야 합니다.
*   **Honesty**: 모르는 파일이나 로직이 있다면 추측하지 말고 **"파일을 먼저 읽어보겠습니다"**라고 말하고 도구를 사용해야 합니다.

---

## ✅ Checklist for Every Task
모든 답변을 생성하기 전 다음 체크리스트를 마음속으로 확인하세요.

- [ ] (New) 작업 전 적절한 문서(계획서/분석서)를 작성하고 승인받았는가?
- [ ] 이 변경이 기존 UI 디자인을 깨뜨리지 않는가?
- [ ] 데이터가 없을 때(Null)를 대비한 로직이 포함되었는가?
- [ ] 하드코딩된 상수나 ID가 없는가?
- [ ] 사용자가 이해할 수 있는 구체적인 예시(시나리오)를 포함했는가?
