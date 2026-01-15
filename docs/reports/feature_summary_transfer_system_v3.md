# Feature Summary: Asset Management & Transfer System V3 Update

**Date:** 2026-01-15
**Branch Focus:** Asset UI Overhaul, Transfer Reconciliation Logic (V3), and Data Integrity.

---

## 1. Asset Management UI Overhaul
사용자 자산 관리 경험을 대폭 개선하기 위해 시각적, 기능적 업데이트를 수행했습니다.

### A. View Options (Sort & Group)
*   **문제**: 자산 개수가 많아질 경우 원하는 자산을 찾기 어렵고, 은행별/목적별 구분이 모호함.
*   **해결**:
    *   **Sort (정렬)**: 높은 잔액순, 낮은 잔액순, 이름순(A-Z) 정렬 추가.
    *   **Group (그룹화)**: '은행(Institution)' 별 및 '자산 유형(Type)' 별 그룹핑 기능 추가.
    *   **UI**: 필터 탭 우측에 `View Options` 버튼을 배치하여 언제든 접근 가능하도록 개선.

### B. Asset Card Design
*   **Design**: 프리미엄 카드를 연상시키는 모던한 디자인으로 리뉴얼.
    *   카드 배경색을 자산 유형별로 미세하게 구분 (Color Palette Update).
    *   정보 계층 정리: 자산명 강조, 계좌번호 마스킹 처리, 별칭(Alias) 병기.

---

## 2. Transfer Reconciliation System (V3)
단순 지출/수입으로 기록된 내역을 "이체(Transfer)"로 지능적으로 변환하는 시스템을 구축했습니다.

### A. Logic (Algorithm)
*   **Auto-Scan**: 앱 실행 시(또는 데이터 변경 시) 자동으로 후보군을 탐색.
*   **Criteria**:
    1.  **Time Window**: 5분 이내 발생한 거래.
    2.  **Amount Match**: 금액의 절댓값이 정확히 일치.
    3.  **Type Check**: 하나는 지출(Expense), 하나는 수입(Income).
    4.  **Asset Constraint**: 서로 다른 자산이어야 하며, 신용카드(Credit Card) 및 대출(Loan) 자산은 제외.

### B. User Interface (Modal Redesign)
*   **Floating Toast**: 배너 형태의 알림을 제거하고, 하단에 비침습적인(Floating) 토스트 알림을 적용하여 작업 흐름을 방해하지 않음.
*   **Reconciliation Modal**:
    *   **Split View**: 출금(Source)과 입금(Target) 내역을 위아래로 분리하여 상세 정보(메모, 카테고리 등)를 온전히 표시.
    *   **Transaction Item Reuse**: 메인 거래 내역과 동일한 `TransactionItem` 컴포넌트를 사용하여 일관성 확보.
    *   **Visual Polish**: 불필요한 이모지 제거, 그룹핑 카드 스타일(Accent Border 제거, Soft Shadow 등) 적용으로 시각적 피로도 감소.

### C. Data Structure
*   **Unidirectional Link**: `to_asset_id`는 출금(Source) 내역에만 기록하여 자금 흐름의 방향을 정의.
*   **Bidirectional Reference**: `linked_transaction_id`는 양쪽 모두에 기록하여 데이터 무결성 보장.

---

## 3. Data Integrity & Migration
데이터의 정확성을 보장하기 위한 안전 장치를 강화했습니다.

### A. Smart Reset
*   **개요**: 모든 거래 내역을 삭제할 때, 자산 잔액이 0이 되지 않고 '초기 잔액(Initial Balance)' 상태로 돌아가도록 하는 로직.
*   **구현**: 삭제 전, 각 자산별 순변동액(Net Impact)을 역산하여 현재 잔액에서 차감함으로써 초기 상태를 복원.

### B. Import Logic
*   **V3 Reconciliation 호환**: 엑셀/CSV 임포트 시에도 V3 로직이 즉시 적용될 수 있도록 데이터 구조 호환성 확보.

---

## 4. UI/UX Refinements
*   **Navigation**: 헤더의 불필요한 'Bills' 버튼 제거 (대시보드로 통합).
*   **Import Wizard**: 파일 업로드 -> 매핑 -> 미리보기 -> 결과의 3단계 위법사 구조 안정화.

---

## Next Steps
*   **Preset System**: 임포트 매핑 설정 저장 기능 구현.
*   **Performance**: 대량 데이터(10,000건+) 렌더링 최적화.
