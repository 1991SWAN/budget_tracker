# 거래 대량 삭제 (Bulk Delete) 기능 구현

## 개요 (Overview)
사용자가 요청한 **다중 거래 선택 및 일괄 삭제** 기능을 구현하였습니다. 자산 잔액의 정확성을 유지하면서 효율적으로 여러 항목을 관리할 수 있도록 시스템 전반을 개선했습니다.

## 주요 변경 사항 (Changes)

### 1. 하이브리드 UX 전략 (Hybrid UX)
- **모바일**: **Long Press(길게 누르기)**로 선택 모드 진입. 이후 탭하여 추가 선택.
- **데스크탑**: 마우스 **Hover(올리기)** 시 체크박스 노출. 클릭하여 선택 모드 진입.
- **액션 바**: 선택 시 **하단 플로팅 액션 바(Bottom Sheet)**가 나타나 선택된 항목 수와 삭제 버튼을 제공.

### 2. 안전한 삭제 로직 (Atomic Deletion)
- **자산 잔액 역산 (Asset Reversion)**: 단순히 삭제만 하는 것이 아니라, 삭제되는 각 거래가 자산에 미쳤던 영향을 **역으로 계산**하여 자산 잔액을 정확히 복구합니다.
- **일괄 처리 (Batch Processing)**:
    - 수십 개의 거래를 선택하더라도, 자산 업데이트와 DB 삭제를 **단일 트랜잭션**처럼 안전하게 순차 처리합니다.
    - `useTransactionManager` 내에서 상태 업데이트를 일괄 수행하여 UI 깜빡임을 방지합니다.

### 3. 컴포넌트 구조 개선 (Implementation Details)
- **`TransactionItem.tsx`**:
    - `isSelectionMode`, `isSelected` prop을 추가하여 체크박스 및 배경색 변경 UI를 표준화했습니다.
    - `onTouchStart`, `onTouchEnd`를 활용한 Long Press 감지 로직 구현.
- **`TransactionList.tsx`**:
    - `selectedIds` (Set) 상태로 다중 선택 관리.
    - `GroupedVirtuoso` 컨텍스트를 통해 모든 아이템에 선택 상태 전달.
    - 하단 액션 바 컴포넌트 통합.
- **`SupabaseService.ts`**:
    - `deleteTransactions(ids: string[])` 메서드 추가 (Batch RPC 호출 최적화 준비 완료).

## 검증 (Verification)
- [x] **진입**: 아이템 길게 누르 시 체크박스 등장 및 하단 바 표시.
- [x] **선택**: 여러 아이템 탭하여 체크/해제 정상 작동.
- [x] **취소**: 하단 바의 'Cancel' 버튼 클릭 시 선택 모드 종료.
- [x] **삭제**: 'Delete' -> 'Confirm Delete' 2단계 확인 후 목록에서 사라짐 & 자산 잔액 복구 확인.

## 다음 단계 (Next Steps)
- 실제 디바이스 테스트 후 피드백 반영.
