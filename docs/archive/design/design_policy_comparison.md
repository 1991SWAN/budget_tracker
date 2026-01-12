# 디자인 정책 비교 보고서 (Design Policy Comparison Report)

## 1. 개요 (Overview)
본 문서는 기존의 디자인 정책 문서(Design System Proposal, Modal Policy)와 새로 작성된 **디자인 개선 연구 보고서** 간의 연관성, 발전 사항, 그리고 충돌 지점을 분석합니다.

새 보고서는 기존 정책을 부정하는 것이 아니라, **"구체적인 형태(Form)"와 "위계(Hierarchy)"의 영역으로 정책을 확장**하는 역할을 합니다.

---

## 2. 비교 분석 (Comparative Analysis)

### A. 디자인 철학 (Design Philosophy)
| 구분 | 기존 정책 (Current Policy) | 개선 제안 (Improvement Report) | 상태 |
| :--- | :--- | :--- | :--- |
| **핵심 가치** | Trustworthy, Modern & Clean, Soft & Friendly | **Premium & Intuitive** (기존 가치 계승 + 고도화) | ✅ 발전 (Evolution) |
| **접근 방식** | 둥근 모서리(Rounded), 여백 활용 | **형태 언어(Shape Language)**를 통한 기능 정의 | 💡 구체화 |

### B. UI 컴포넌트 & 형태 (Components & Shape)
가장 큰 변화가 있는 영역입니다. 기존 정책은 단순한 스타일 가이드였다면, 개선안은 "기능에 따른 형태의 차별화"를 제안합니다.

| 항목 | 기존 정책 | 개선 제안 | 분석 |
| :--- | :--- | :--- | :--- |
| **버튼 (Action)** | 모든 버튼 `Rounded-2xl` 권장 | **Primary Action = `Rounded-full` (타원형)**<br>Navigation = `Rounded-lg/xl` (사각형) | **위계 세분화**<br>기능적 목적에 따라 형태를 분리하여 직관성 강화. |
| **사이드바** | (별도 규정 없음)<br>리스트 형태 배치 | **Zone 분리** (Nav / Action / User)<br>위치와 형태를 통한 맥락 구분 | **신규 정의**<br>단순 배치를 넘어선 구조적 설계 제안. |
| **카드 (Card)** | `Rounded-3xl`, `Shadow-sm` | **Bento Grid** 레이아웃<br>미니 차트(Sparkline) 등 시각화 추가 | **표현력 강화**<br>단순 정보 담기를 넘어선 시각적 재미 추구. |

### C. 인터랙션 (Interaction)
| 항목 | 기존 정책 | 개선 제안 | 분석 |
| :--- | :--- | :--- | :--- |
| **Hover** | 색상 변경 (`bg-slate-800` 등) | **Scale & Lift** (`Scale-105`, `Shadow-md`)<br>클릭 시 `Scale-95` (쫀득한 느낌) | **경험 고도화**<br>정적인 UI에 물리적 피드백을 더해 몰입감 증대. |

### D. 모달 (Modal)
| 항목 | 기존 정책 | 개선 제안 | 분석 |
| :--- | :--- | :--- | :--- |
| **Mobile** | Bottom Sheet, Drag-to-dismiss | (기존 정책 유지) | ✅ **일치** |
| **Desktop** | Center Dialog, Headless | (기존 정책 유지) | ✅ **일치** |
| **공통** | `bg-black/40` Dimming | (기존 정책 유지) | ✅ **일치** |

---

## 3. 핵심 시사점 (Key Takeaways)

1.  **"스타일"에서 "언어"로의 진화**:
    *   기존 정책이 "어떻게 보이는가(Color, Radius)"에 집중했다면, 개선 제안은 **"어떻게 인지되는가(Shape, Context)"**에 집중합니다.
    *   예: 모든 버튼이 둥글면 예쁘지만(Style), "이동 버튼"과 "실행 버튼"이 다르게 생겨야 헷갈리지 않습니다(Language).

2.  **모호했던 영역의 규정**:
    *   사이드바의 버튼들이 제각각이었던 이유는 "네비게이션 버튼"과 "액션 버튼"에 대한 명확한 형태 규정이 없었기 때문입니다. 개선안이 이를 해결합니다.

3.  **충돌 없음 (No Conflicts)**:
    *   개선 제안은 기존의 컬러 시스템(Slate/Emerald/Rose)과 타이포그래피 규칙을 그대로 따르며, 적용 범위와 디테일만 확장했으므로 기존 코드를 폐기할 필요 없이 **점진적 리팩토링**이 가능합니다.

---

## 4. 제언 (Recommendation)

기존 `docs/design/design_system_proposal.md`를 **v2.0으로 업데이트**하여 본 보고서의 내용을 통합하는 것을 권장합니다.
특히 **"Shape Guidelines (형태 규정)"** 섹션을 개선안의 내용("기능별 형태 분리")으로 구체화해야 합니다.
