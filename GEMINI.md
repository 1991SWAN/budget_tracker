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
**"무작정 실행하지 않고, 근거를 확인한 후 실행한다. (Verify-then-Act)"**

*   **Evidence-Based Logic**: 추측성 코드(예: "삭제했으니 0원이겠지")를 금지합니다. 반드시 **`count`나 `exists` 쿼리로 실제 DB 상태를 검증한 후**에 후속 작업(Update)을 수행해야 합니다.
*   **Null Safety**: `category`가 `undefined`이거나, 배열이 비어있는 경우를 항상 가정하고 이에 대한 **Fallback 로직**을 포함해야 합니다.
*   **No Hardcoding**: UI에서 보이는 텍스트나 값에 의존하지 않고, 항상 ID나 Type 같은 불변의 키를 사용해야 합니다.

## 3. 🔐 Security & Privacy Policy (보안 최우선)
**"기능이 아무리 좋아도 보안이 뚫리면 쓰레기 코드다."**

*   **RLS First**: 새로운 테이블이나 컬럼을 추가할 때, 가장 먼저 **Row Level Security (RLS)** 정책부터 수립해야 합니다.
*   **Block Anonymous**: `authenticated` 역할이라도 안심하지 말고, 반드시 `is_anonymous` 클레임을 체크하여 **익명 사용자의 접근을 원천 차단**해야 합니다.
*   **Function Safety**: Database Function 작성 시 `search_path`를 명시적으로 설정하여 SQL Injection 공격을 방지해야 합니다.

## 4. 🧪 Simulation & Verification Strategy (시뮬레이션 검증)
**"구체적인 시나리오로 검증한다."**

*   **Scenario First**: 복잡한 로직을 구현할 때는, 코드 작성 전 **"5가지 시나리오 보고서"**를 작성하여 타당성을 승인받아야 합니다.
*   **Concrete Examples**: "잘 작동할 것입니다" 대신, **"A상황(입력값 X)에서는 B가 출력됩니다"**라는 구체적인 예시를 제시해야 합니다.

## 5. 📝 Communication Style (커뮤니케이션)
**"일반론이 아닌, 내 프로젝트의 맥락(Context)에서 말한다."**

*   **Specific Evidence**: 답변 시 "파일 경로", "실제 파일 크기", "관련된 컴포넌트 이름"을 구체적으로 언급하여 프로젝트 이해도를 증명해야 합니다.
*   **Honesty**: 모르는 파일이나 로직이 있다면 추측하지 말고 **"파일을 먼저 읽어보겠습니다"**라고 말하고 도구를 사용해야 합니다.

---

## ✅ Checklist for Every Task
모든 답변을 생성하기 전 다음 체크리스트를 마음속으로 확인하세요.

- [ ] (New) 작업 전 문서(계획서/분석서/보고서)를 작성하고 승인받았는가?
- [ ] (Verify) 상태를 변경하기 전, `Select`나 `Count`로 선행 조건을 검증(Verify-then-Act)했는가?
- [ ] (Security) RLS 정책과 익명 사용자 차단 로직이 포함되었는가?
- [ ] 이 변경이 기존 UI 디자인을 깨뜨리지 않는가?
- [ ] 데이터가 없을 때(Null)를 대비한 로직이 포함되었는가?
