# 🏗️ Codebase Optimization & Refactoring Report

*Date: 2026-01-17*
*Scope: Component Structure, Performance, and Maintainability*

## 1. 개요 (Overview)
현재 코드베이스를 스캔한 결과, 기능이 확장되면서 **일부 핵심 컴포넌트가 비대해지고(Monolithic)** 구조적 복잡도가 증가하고 있습니다.
앱의 성능과 유지보수성을 위해 다음 영역의 **모듈화 및 최적화**를 제안합니다.

---

## 2. 주요 최적화 대상 (High Priority Targets)

### 🚨 1. `AssetManager.tsx` (Critical)
*   **현황**: 935줄, 47KB. 단일 파일에 너무 많은 책임이 집중되어 있습니다.
*   **문제점**:
    *   `AssetForm` (입력 폼)
    *   `AssetDetailModal` (상세 모달 & 차트)
    *   `AssetCard` (리스트 아이템)
    *   메인 리스트 로직이 모두 한 파일에 존재합니다.
*   **제안 (Refactoring Plan)**:
    *   `components/assets/AssetForm.tsx` 분리
    *   `components/assets/AssetDetailModal.tsx` 분리
    *   `components/assets/AssetCard.tsx` 분리
    *   `AssetManager.tsx`는 이들을 조립하는 컨테이너 역할만 수행.

### ⚠️ 2. `App.tsx` (High)
*   **현황**: 759줄, 38KB. 앱의 모든 "상태 관리"와 "이벤트 핸들러"가 집중된 God Component입니다.
*   **문제점**:
    *   수십 개의 모달(`openAddBill`, `openEditGoal`...)을 위한 State와 핸들러가 가독성을 떨어뜨립니다.
    *   `loadData` 등 초기화 로직과 비즈니스 로직(`handleImport`)이 혼재되어 있습니다.
*   **제안 (Refactoring Plan)**:
    *   **Hook Extraction**: `useModalManager`를 만들어 모달 열기/닫기 로직을 외부로 추출.
    *   **Logic Separation**: `useInitialization` 훅으로 데이터 로딩 로직 분리.

### ℹ️ 3. `SmartInput.tsx` (Medium)
*   **현황**: 493줄. 복잡한 입력 로직, 태그 파싱, 자동완성 등이 포함됨.
*   **제안**:
    *   `useSmartParser`: 텍스트 파싱 로직(태그/금액 추출)을 별도 Hook/Utility로 분리.

---

## 3. 성능 최적화 (Performance)

### 🚀 리렌더링 방지
*   **Context API**: 현재 `ToastContext` 외에는 전역 상태가 `App.tsx`에 몰려 있어, `setTransactions`가 호출될 때마다 하위 컴포넌트(모달 등)가 불필요하게 리렌더링될 가능성이 높습니다.
*   **Action Plan**:
    *   주요 도메인 데이터(`assets`, `transactions`)를 `DataContext`로 감싸거나,
    *   `React.memo`를 사용하여 `PureComponent` 패턴을 적극 도입.

### 🔍 쿼리 효율화
*   `SupabaseService`에서 `deleteTransactionsByAsset` 구현 시 `count` 쿼리를 추가했습니다.
*   앞으로도 "쓰기(Write)" 작업 전후에는 **최소한의 필드(`select('id')`)만 조회**하여 네트워크 비용을 줄이는 패턴을 유지해야 합니다.

---

## 4. 결론 및 로드맵
위 최적화 작업은 앱의 "기능"을 바꾸지 않으면서 "내실"을 다지는 작업입니다.
가장 시급한 **`AssetManager.tsx` 분리**부터 시작하는 것을 추천합니다.
