# 🐛 Bug Report: Stale Transaction List after Clear History

*Date: 2026-01-17*
*Status: Investigating*
*Severity: Moderate (UI Consistency)*

## 1. 문제 현상 (Symptoms)
사용자가 `Asset Manager` 모달에서 특정 자산의 **"Clear History (내역 초기화)"**를 실행했을 때:
1.  **DB**: 해당 내역들이 정상적으로 삭제됨. (확인됨)
2.  **Chart**: 모달 내의 잔액 차트가 초기화됨. (정상 - State Update 작동함)
3.  **UI List**: 하지만 화면(메인 리스트 등)에 **거래 내역이 여전히 남아있음**. (버그)

## 2. 원인 분석 (Root Cause Analysis)

### 2.1 코드 검토 결과
*   `App.tsx`의 `onClearHistory` 핸들러는 `setTransactions`를 통해 전역 상태를 올바르게 업데이트하고 있습니다.
    ```typescript
    setTransactions(prev => prev.filter(t => t.assetId !== assetId ...));
    ```
*   `AssetDetailModal` (모달 내부)은 이 변경된 `transactions`를 Prop으로 받아 차트를 정상적으로 다시 그립니다.
*   **핵심 의문**: 그렇다면 사용자가 보고 있는 "남아있는 내역"은 무엇인가?
    *   `AssetManager` 모달 자체에는 "거래 내역리스트"가 없습니다 (할부 내역 제외).
    *   따라서 사용자는 모달 뒤쪽(또는 모달 닫은 후)의 **메인 화면 `TransactionList`**를 보고 있을 가능성이 높습니다.

### 2.2 가설: Virtualized List 갱신 실패
메인 화면의 `TransactionList` 컴포넌트는 성능 최적화를 위해 `react-virtuoso` (가상 스크롤)를 사용하고 있습니다.
*   데이터가 대량으로 삭제되었을 때, 가상 리스트 컴포넌트가 내부 캐시나 인덱스를 즉시 갱신하지 못하고 **이전 렌더링 결과(Stale Render)**를 보여주고 있을 가능성이 큽니다.
*   또는 `TransactionList.tsx` 내부의 `groupTransactions` 로직인 `useMemo` 의존성 배열 문제일 수도 있습니다.

## 3. 해결 방안 (Action Plan)

1.  **`TransactionList.tsx` 점검**:
    *   `useMemo`가 `transactions` 변경을 감지하는지 확인.
    *   `GroupedVirtuoso` 컴포넌트에 `key` prop을 부여하여, 데이터가 크게 변할 때(초기화 등) 강제로 리마운트(Remount) 시키는 방법을 고려.
2.  **State Update Timing**:
    *   `setTransactions` 직후 `forceUpdate`가 필요한지 확인.

## 4. 결론
데이터는 안전하게 지워졌으나, **화면 표시(View)**만 갱신되지 않은 상태입니다. 앱을 새로고침하면 사라질 것입니다.
근본적인 해결을 위해 `TransactionList`의 렌더링 로직을 수정하겠습니다.
