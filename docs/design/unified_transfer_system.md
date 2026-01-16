# Unified Transfer System & Counterpart Strategy

*Created: 2026-01-16*
*Author: SmartPenny Dev Team*

## 1. 개요 (Overview)
본 문서는 SmartPenny의 **자산 간 이체(Transfer) 및 카드 대금 납부**를 처리하는 핵심 로직인 **"Counterpart Strategy"**와 **"Unified Dual View"**에 대해 정의합니다.

### 🎯 핵심 목표
1.  **데이터 무결성 (Integrity)**: 모든 자산의 잔액 변동은 반드시 **'거래 내역(Transaction)'**에 근거해야 한다. (임의 수정 금지)
2.  **사용자 경험 (UX)**: "출금 통장"에서 보든 "입금 카드"에서 보든, 사용자는 **"어디서 나가서 어디로 들어왔는지"**를 명확히 알 수 있어야 한다.

---

## 2. Counterpart Strategy (거래 쌍 생성 전략)

기존에는 카드 대금을 납부할 때 '단순 지출'로 처리하거나 '잔액만 수정'하는 방식이었습니다. 이는 "돈이 사라지는" 것처럼 보이며, 부채 감소가 투명하게 기록되지 않는 문제가 있었습니다.

이를 해결하기 위해 **"실제 이체와 동일하게 2개의 거래 내역을 생성"**하는 전략을 채택했습니다.

| 구분 | Source Transaction (출금) | Target Transaction (입금) |
| :--- | :--- | :--- |
| **Type** | `TRANSFER` (Send) | `TRANSFER` (Receive) |
| **Amount** | `-100,000` | `+100,000` |
| **Asset** | Checking Account (통장) | Credit Card (카드) |
| **To Asset** | Credit Card | `null` (자신이 수신자임) |
| **Linked ID** | Target Transaction ID | Source Transaction ID |
| **의미** | 통장 잔액 감소 | **카드 부채 감소 (상환)** |

> **Note**: 카드에 `TRANSFER` 타입의 `+금액`이 찍히면, 이는 수입(Income)으로 잡히지 않고 **"부채의 감소"**로 정확히 회계 처리됩니다.

---

## 3. Unified Dual View (통합 이중 뷰)

사용자가 어떤 자산을 보고 있느냐에 따라 UI가 파편화되는 문제를 해결하기 위해, **어느 쪽에서 조회하든 정보가 풍성한 2줄 보기(Dual View)**를 제공합니다.

### 3.1 렌더링 로직
*   **Source Asset View**:
    *   Row 1: Source Asset Name (-Amount) [Red]
    *   Row 2: Target Asset Name (+Amount) [Green]
*   **Target Asset View**:
    *   Row 1: Source Asset Name (-Amount) [Red] (*Linked Data 조회*)
    *   Row 2: Target Asset Name (+Amount) [Green]

> **결과**: 사용자는 **"항상 동일한 형태의 이체 흐름"**을 목격하게 됩니다.

### 3.2 Deduplication (중복 제거)
"전체 보기(All Assets)" 탭에서는 리스트에 Source 내역과 Target 내역이 모두 로드됩니다. 이때 똑같은 내용을 두 번(총 4줄) 보여주는 것은 낭비입니다.

*   **Rule**: "내 짝꿍(Source)이 리스트 보이면, 나(Target)는 숨는다."
*   **Result**: 전체 보기에서는 Source 내역 하나만 렌더링되며, 클릭 시 상세 정보에서 연결 정보를 확인할 수 있습니다.
*   **Exception**: 특정 자산 필터(Target Asset Only) 상태에서는 짝꿍이 안 보이므로, Target 내역이 스스로를 드러내어 Dual View를 그립니다.

---

## 4. Technical Implementation

### 4.1 Client-Side Join
DB 스키마의 제약(Missing Foreign Key)으로 인해 서버 사이드 조인 대신, **클라이언트 사이드 조인**을 사용하여 성능과 안정성을 확보했습니다.

*   `supabaseService.ts`: 모든 트랜잭션을 가져온 후, `Map<ID, AssetID>`를 생성하여 메모리상에서 `linkedTransactionSourceAssetId`를 매핑합니다.
*   `TransactionItem.tsx`: 매핑된 `fromAsset` 정보를 활용해 수신 측에서도 송금처를 그릴 수 있게 되었습니다.

### 4.2 Design Decision
*   이체 내역은 일반 내역과 **동일한 배경색(White)**을 유지하여 시각적 피로도를 줄였습니다.
*   대신 **Dual Line (Red/Green)** 텍스트 배치만으로도 충분히 이체임을 인지할 수 있도록 디자인되었습니다.
