# 자산 정보 고도화 스키마 제안 (Asset Schema Proposal)

자산 관리 기능을 강화하기 위해 다음과 같은 데이터 구조 확장을 제안합니다.

## 1. 공통 필드 (Common Fields)
모든 자산 유형에 공통적으로 추가되는 필드입니다.

*   `institution`: 금융기관명 (예: 국민은행, 삼성카드).
*   `accountNumber`: 계좌/카드번호 뒷 4자리 (식별용).
*   `excludeFromTotal`: 총자산 합계에서 제외 여부 (boolean).
*   `theme`: 카드/통장 색상 테마 (Gradient 등).

```typescript
export interface AssetBase {
  // ... 기존 필드 (id, name, balance...)
  institution?: string;     // 금융기관 (Bank/Card issuer)
  accountNumber?: string;   // 마지막 4자리 (Last 4 digits)
  excludeFromTotal?: boolean; // 총자산 제외 여부
  theme?: string;           // 시각적 테마 (Color/Gradient)
}
```

## 2. 유형별 상세 스키마 (Type-Specific Details)

### A. 은행 계좌 (Bank Accounts - CHECKING / SAVINGS)
입출금 및 예적금 계좌를 위한 정보입니다.

```typescript
export interface BankDetails {
  interestRate?: number;    // 이자율/금리 (%)
  maturityDate?: string;    // 만기일 (예적금의 경우)
  isMainAccount?: boolean;  // 주거래 계좌 여부 (UI 강조)
}
```

### B. 신용카드 (Credit Card - CREDIT_CARD)
기존 구조를 유지하되 편의성을 강화합니다.

```typescript
export interface CreditCardDetails {
  limit: number;            // 한도
  paymentDate: number;      // 결제일 (매월 일자)
  statementDate?: number;   // 명세서 기준일 (공여기간 계산용)
  points?: number;          // 보유 포인트 (선택 사항)
  apr?: number;             // 할부 이자율
}
```

### C. 대출 (Loan - LOAN)
상환 스케줄 관리를 위한 핵심 정보입니다.

```typescript
export interface LoanDetails {
  principal: number;        // 원금 (최초 대출액)
  interestRate: number;     // 금리 (%)
  startDate: string;        // 대출 실행일
  endDate: string;          // 만기일 (예상)
  termMonths: number;       // 대출 기간 (개월)
  monthlyPayment: number;   // 월 상환액 (원리금)
  paymentType: 'AMORTIZATION' | 'INTEREST_ONLY'; // 상환 방식 (원리금균등 / 만기일시)
}
```

### D. 투자 & 실물 자산 (Investment & Physical Assets - INVESTMENT) [MERGED]
주식, 코인뿐만 아니라 부동산, 차량 등 가치 변동이 있는 모든 자산을 포괄합니다.

```typescript
export interface InvestmentDetails {
  // 주식/코인용 (Stocks/Crypto)
  symbol?: string;          // 티커 (예: AAPL, BTC)
  quantity?: number;        // 보유 수량
  averagePrice?: number;    // 평단가

  // 부동산/차량용 (Real Estate/Vehicle)
  address?: string;         // 주소 또는 모델명
  purchasePrice?: number;   // 매입가 (취득가액)
  purchaseDate?: string;    // 매입일
  
  // 공통 (Common)
  currentPrice?: number;    // 현재 단가 (주식) 또는 현재 시세 (부동산)
  valuationDate?: string;   // 시세 기준일
  roi?: number;             // 수익률 (자동 계산)
}
```

### E. (Removed - Merged into D)

## 3. 구현 단계 (Plan)

1.  **Types 정의**: `types.ts` 업데이트.
2.  **DB 마이그레이션**: Supabase에 JSONB 컬럼 활용 또는 개별 컬럼 추가. (JSONB 추천: `details` 컬럼 하나에 타입별 객체 저장)
3.  **UI 업데이트**: `AssetForm` 모달에 유형별 입력 폼 구현.

이 스키마대로 진행해도 될까요? 특히 **부동산/차량** 자산 타입을 새로 추가할지, 아니면 '기타(Investment)'로 퉁칠지 결정이 필요합니다.
