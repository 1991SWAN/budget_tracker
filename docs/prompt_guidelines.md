# SmartPenny Prompt Engineering Guidelines

효율적인 개발을 위해 AI(Cortex)에게 작업을 지시할 때 사용할 수 있는 **Project-Specific Prompt Examples**입니다.
이 프로젝트의 기술 스택(React, TypeScript, Supabase, Tailwind)과 파일 구조를 반영했습니다.

---

## 1. 🛠 리팩토링 및 구조 개선 (Refactoring)
기존 컴포넌트를 분리하거나 로직을 Hook으로 추출할 때 사용합니다.

> **Context**: `AssetManager.tsx`가 너무 커져서 유지보수가 어렵습니다.
> **Prompt**:
> "현재 `components/AssetManager.tsx` 파일이 500줄을 넘어 너무 복잡해.
> 내부의 **`AssetCard` 렌더링 로직**을 별도의 `components/ui/AssetCard.tsx` 컴포넌트로 분리해줘.
> Props 인터페이스를 정의하고, 기존 스타일(`bg-white rounded-2xl...`)을 그대로 유지해줘."

> **Context**: `smart_transfer` 로직이 복잡해짐.
> **Prompt**:
> "`hooks/useTransferReconciler.ts`의 `scanCandidates` 함수가 너무 길어.
> **단일 결제 감지 로직(Single Detection)**과 **이체 쌍 감지 로직(Pair Detection)**을 각각 별도 함수로 분리해서 가독성을 높여줘."

---

## 2. 🐛 버그 수정 및 디버깅 (Debugging)
특정 동작이 안 될 때 구체적인 파일과 증상을 명시합니다.

> **Context**: `ReconciliationModal`에서 리스트가 안 뜸.
> **Prompt**:
> "`components/ReconciliationModal.tsx`를 확인해줘.
> `singleCandidates` 데이터가 들어오는데도 화면에 **'No matches found'**라고 뜨는 것 같아.
> `allItems` 배열을 생성하는 로직과 `length` 체크하는 부분을 점검해서 원인을 찾아줘."

> **Context**: CSV Import 시 날짜가 밀림.
> **Prompt**:
> "`services/ImportService.ts`의 `parseDate` 함수를 확인해줘.
> CSV에서 `2024-01-01`을 읽을 때 타임존 문제로 하루 전날로 저장되는 것 같아.
> `UTC` 대신 로컬 타임존을 기준으로 처리하도록 수정해줘."

---

## 3. 🎨 UI/UX 구현 (UI Implementation)
TailwindCSS와 기존 디자인 시스템(`components/ui/`)을 활용하도록 지시합니다.

> **Context**: 새로운 '예산 설정' 모달이 필요함.
> **Prompt**:
> "새로운 컴포넌트 `components/settings/BudgetModal.tsx`를 만들어줘.
> `components/ReconciliationModal.tsx`의 디자인(헤더 스타일, 닫기 버튼, 라운드 처리)을 참고해서 통일감 있게 만들어줘.
> 내부에는 `Monthly Budget`을 입력받는 인풋 필드와 저장 버튼을 배치해줘."

> **Context**: 대시보드 차트 개선.
> **Prompt**:
> "`components/Dashboard.tsx`의 차트 영역이 모바일에서 너무 좁아.
> Tailwind의 `md:flex-row flex-col` 클래스를 활용해서, 모바일에서는 차트가 세로로 쌓이고 데스크탑에서는 가로로 배치되도록 반응형 스타일을 수정해줘."

---

## 4. 🗄 데이터 및 로직 연동 (Data & Logic)
Supabase 서비스와 Hook 연동을 지시합니다.

> **Context**: 새로운 자산 타입 추가.
> **Prompt**:
> "`types.ts`의 `AssetType` Enum에 `CRYPTO`를 추가하고,
> `components/AssetManager.tsx`에서 자산 추가 시 '암호화폐'를 선택할 수 있게 폼을 업데이트해줘.
> `SupabaseService.saveAsset`은 이미 타입을 받고 있으니 그대로 두면 돼."

> **Context**: 이체 무시 기능 연동.
> **Prompt**:
> "`App.tsx`에서 `handleIgnore` 함수를 수정해줘.
> 무시된 트랜잭션 ID를 `localStorage`에 저장해서, 다음 번 `useTransferReconciler` 스캔 시에는 해당 ID를 제외하도록 로직을 추가해줘."

---

## 💡 Pro Tips for SmartPenny

1.  **파일 경로 명시**: 그냥 "모달 수정해줘"보다 **"`components/ReconciliationModal.tsx`를 수정해줘"**라고 할 때 훨씬 정확합니다.
2.  **기존 코드 참조**: "새 버튼을 만들어줘" 대신 **"`components/ui/Button.tsx`를 재사용해서 만들어줘"**라고 하면 디자인 일관성이 유지됩니다.
3.  **타입 명시**: 데이터 구조 변경 시 **"`types.ts`부터 정의해줘"**라고 하면 타입스크립트 에러를 방지할 수 있습니다.
