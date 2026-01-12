# CSV/Excel 가져오기 재구축 계획 (CSV/Excel Import Refactor Plan)

## 목표 (Goal)
기존의 유연하지 않은 "고정 포맷" CSV 가져오기 기능을, **컬럼 매핑(Column Mapping)** 및 **데이터 미리보기(Data Preview)** 기능을 통해 다양한 은행/카드사 형식을 지원하는 사용자 친화적인 시스템으로 교체합니다.

## 해결해야 할 핵심 문제 (Core Problems to Solve)
1.  **불안정한 파싱**: 현재 `split(',')` 방식은 따옴표로 묶인 텍스트(예: `"Starbucks, Inc."`)를 제대로 처리하지 못하고 깨집니다.
2.  **경직된 구조**: 오직 `날짜, 적요, 금액` 순서만 지원합니다. 실제 명세서는 순서가 제각각입니다.
3.  **피드백 부재**: 저장이 완료되기 전까지는 어떤 행이 건너뛰어졌는지, 에러가 났는지 알 수 없습니다.

## 제안된 해결책: 가져오기 마법사 (Import Wizard)

UI에 3단계로 구성된 '가져오기 마법사'를 구현합니다.

### 1단계: 파일 선택 및 파싱 (File Selection & Parsing)
- `xlsx` 라이브러리를 사용하여 CSV와 Excel 파일을 모두 강력하게 파싱합니다.
- 원본 데이터를 2차원 배열(Grid) 형태로 읽어옵니다.
- **검증**: 파일이 읽기 가능한지 확인합니다.

### 2단계: 컬럼 매핑 (Column Mapping)
- 처음 5개 행을 테이블 형태로 미리 보여줍니다.
- 사용자가 각 열(Column)이 무엇인지 지정할 수 있게 합니다:
    - **날짜 (Date)**: (필요 시 날짜 형식 선택 가능)
    - **적요/내용 (Description/Memo)**
    - **금액 (Amount)**
    - **(선택) 유형 (Type)**: (수입/지출이 별도 컬럼인 경우 대응)
- *추후 계획*: 이 매핑 설정을 "프리셋(Presets)"으로 저장 (예: "삼성카드 설정").

### 3단계: 검토 및 실행 (Review & Execution)
- 사용자의 매핑 정보를 바탕으로 `ImportService` 로직을 가상으로 수행합니다.
- **저장하기 전**에 요약 정보를 보여줍니다:
    - ✅ 15건 유효 (Valid)
    - ⚠️ 3건 중복 (Duplicates - 건너뜀)
    - 🔄 2건 이체 매칭됨 (Transfers Detected)
- [확인 및 저장] 버튼을 눌러야 실제 Supabase DB에 저장됩니다.

## 기술적 변경 사항 (Technical Changes)

### 1. `ImportService.ts` 리팩토링
- `parseCSV`를 `xlsx.read`를 사용하는 로직으로 교체 (견고한 파싱).
- `parseRawData(data: any[][], mapping: ColumnMapping)` 함수 추가.
- `ColumnMapping` 인터페이스 정의:
  ```typescript
  interface ColumnMapping {
    dateIndex: number;
    amountIndex: number;
    memoIndex: number;
    // Optional: Date format string (e.g. 'YYYYMMDD')
  }
  ```

### 2. UI 컴포넌트
- **`ImportWizardModal.tsx`**: 마법사 단계를 관리하는 새로운 컴포넌트.
- **`ColumnMapper.tsx`**: 데이터 그리드 상단에 드롭다운을 배치하여 열을 선택하는 UI.
- **`ImportPreview.tsx`**: 유효한 항목과 제외된 항목을 보여주는 요약 화면.

## 검증 계획 (Verification Plan)
- **자동화 테스트**: 다양한 매핑 케이스에 대해 `parseRawData` 유닛 테스트.
- **수동 검증**:
    - "표준" CSV 가져오기.
    - "까다로운" CSV 가져오기 (따옴표 포함, 컬럼 순서 섞임).
    - Excel 파일 가져오기.
    - 중복 방지 기능 작동 확인.
    - 이체 매칭(Transfer Matching) 알고리즘 작동 확인.
