# 이체 연결 내역 표기 로직 상세 보고서

사용자 요청에 따라, **이체(Transfer) 연결 시 내역이 화면에 어떻게 표시되는지** 그 상세 로직을 정리해 드립니다.

## 1. 기본 원칙
이체는 **출금(Source)** 내역을 기준으로 통합되어 표시되며, **입금(Destination)** 내역은 목록에서 숨겨집니다. 대신, 출금 내역 카드 안에 입금 정보를 함께 보여줍니다.

## 2. 표시 조건 (Rendering Condition)
코드는 다음 3가지 조건이 모두 충족될 때 "두 줄형 연결 표기"를 활성화합니다.

```typescript
if (isTransfer && transaction.toAssetId && toAsset)
```
1.  **`isTransfer`**: 거래 유형이 '이체'여야 합니다.
2.  **`transaction.toAssetId`**: 데이터베이스에 '받는 계좌 ID'가 저장되어 있어야 합니다. (이것이 출금 측임을 증명)
3.  **`toAsset`**: 해당 ID에 매칭되는 실제 자산 정보가 프론트엔드에 로드되어 있어야 합니다.

## 3. UI 구현 상세 (Detailed Specifications)
V3 이체 카드의 우측 금액 영역은 아래와 같이 정밀하게 디자인되었습니다 (Tailwind CSS 기준).

### 📐 레이아웃 구조
- **컨테이너**: `flex-col` (수직 정렬), `items-end` (우측 정렬)
- **간격**: 두 줄 사이 간격 없음 (Tight Spacing)

### 🔴 Line 1: 출금 (Withdrawal)
가장 위쪽에 표시되며, 돈이 나가는 정보를 담습니다.
- **레이아웃**: `flex items-center gap-1.5`
- **은행명**:
    - **폰트**: `text-[10px]` (매우 작음), `text-slate-400` (회색), `truncate` (말줄임)
    - **가시성**: 모바일(`md` 미만)에선 숨김 처리될 수 있음 (`hidden md:block`)
- **금액**:
    - **폰트**: `text-[15px]` (기본 크기), `font-bold` (굵게)
    - **색상**: `text-rose-600` (진한 빨강)
    - **내용**: `-{formattedAmount}` (마이너스 부호 필수)

### 🟢 Line 2: 입금 (Deposit)
출금 바로 아래 위치하며, 돈이 들어가는 정보를 담습니다.
- **레이아웃**: `flex items-center gap-1.5`, `mt-0.5` (미세한 상단 여백)
- **은행명**: Line 1과 동일 스타일 (`text-[10px]`, `text-slate-400`)
- **금액**:
    - **폰트**: `text-[13px]` (Line 1보다 약간 작음 - 위계 구분), `font-bold`
    - **색상**: `text-emerald-600` (진한 초록)
    - **내용**: `+{formattedAmount}` (플러스 부호 필수)

## 4. 데이터 흐름 요약
1.  **Link 실행**: 출금 거래에 `to_asset_id` 필드를 업데이트하여 저장합니다.
2.  **Mapping**: 앱 실행 시 DB의 `to_asset_id`를 `toAssetId`로 변환하여 메모리에 로드합니다.
3.  **Rendering**: `TransactionItem` 컴포넌트가 `toAssetId`를 확인하고 위 로직에 따라 UI를 그립니다.

---
**비고**: 연결되지 않은(Unlinked) 이체나, 데이터가 불완전한 과거 내역은 기존처럼 단일 파란색 라인으로 표시될 수 있습니다.
