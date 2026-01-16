# 📘 Guideline Review & Enhancement Proposal

*Date: 2026-01-17*
*Topic: Prompt Guidelines vs. Current Project Standards*

## 1. 분석 결과 (Analysis)
`docs/prompt_guidelines.md` 파일을 검토한 결과, 현재의 가이드라인은 **"효율적인 작업 지시(Speed & Structure)"**에 초점이 맞춰져 있습니다.

*   ✅ **잘된 점 (Good)**:
    *   **Specific Paths**: 파일 경로를 명시하는 습관은 이미 잘 정착되어 유지보수에 큰 도움이 되고 있습니다.
    *   **Component Reuse**: `components/ui` 활용 원칙 덕분에 UI 일관성이 유지되고 있습니다.

*   ⚠️ **보완이 필요한 점 (Missing Links)**:
    *   오늘 사용자의 핵심 피드백이었던 **"논리적 검증(Logic Verification)"**과 **"방어적 코딩(Defensive Coding)"**에 대한 항목이 부재합니다.
    *   단순히 "구현해줘"가 아니라, **"데이터 무결성을 어떻게 보장할 것인가"**에 대한 가이드가 추가되어야 합니다.

---

## 2. 제안: 가이드라인 확장 (Proposed Additions)

다음 두 가지 섹션을 `prompt_guidelines.md`에 추가하여, 향후 모든 작업의 품질 기준을 높일 것을 제안합니다.

### 🆕 5. 🛡 논리적 검증 및 안정성 (Logic & Stability)
"무작정 실행하지 말고, 근거를 확인한 후 실행하라." (Verify-then-Act)

> **Context**: 데이터 삭제 로직 구현.
> **Prompt**:
> "`SupabaseService.deleteAssets` 함수를 짤 때,
> 1.  먼저 `delete()`를 수행하고,
> 2.  **`select count`로 실제 삭제 여부를 검증**한 뒤,
> 3.  검증된 경우에만 성공 리턴을 하는 **'Verify-then-Act' 패턴**으로 구현해줘."

### 🆕 6. 🔐 보안 및 권한 (Security & Privacy)
"RLS와 권한 체크를 최우선으로 고려하라."

> **Context**: 새로운 테이블(예: `memos`) 추가.
> **Prompt**:
> "새 테이블 `memos`를 만들 때, 기능 구현보다 먼저 **RLS 정책(Policy)**부터 수립해줘.
> 익명 사용자는 절대 읽을 수 없게 `is_anonymous` 체크를 포함하고,
> 오직 `user_id`가 일치하는 본인만 접근 가능하도록 `auth.uid()` 로직을 적용해줘."

---

## 3. 결론
이 내용을 가이드라인에 공식적으로 업데이트한다면, 향후 AI(Cortex)가 코드를 작성할 때 **"기능 동작"뿐만 아니라 "안정성과 보안"을 스스로 먼저 챙기는 효과**가 있을 것입니다.

바로 업데이트를 진행할까요?
