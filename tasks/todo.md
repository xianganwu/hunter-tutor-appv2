# Fix Math Questions with Wrong/Ambiguous Correct Answers

## Confirmed Issues (8 total across 4 forms)

### Form 1 (form_1.json)
- [x] **Q63 (m_13)** — Hat operator: correctAnswer "E" (9) → "A" (1/9). 3^ * 3^ = (1/3)(1/3) = 1/9.
- [x] **Q68 (m_18)** — Nancy coins: correctAnswer "C" (2 dimes) → "B" (2 nickels). 2 coins worth $0.10.
- [x] **Q71 (m_21)** — Exponents: correctAnswer "A" (8/27) → "D" (8/9). 2^3/3^2 = 8/9.
- [x] **Q80 (m_30)** — Photo frame: correctAnswer "A" (24%) → "B" (30%). 24/80 = 30%.

### Form 2 (form_2.json)
- [x] **Q52 (m_02)** — Equivalent answers: replaced B ".60" → "18%" and D ".40" → "20%". Correct answer C (40%) unchanged.

### Form 3 (form_3.json)
- [x] **Q57 (m_07)** — Coins: correctAnswer "A" (7) → "D" (10). 10 distinct sums with same-denomination pairs.
- [x] **Q60 (m_10)** — Commission: correctAnswer "C" ($315) → "A" ($335). $80 + $230 + $25 = $335.

### Form 4 (form_4.json)
- [x] **Q64 (m_14)** — Fraction addition: question text "2 3/4" → "2 1/3". Now 1 1/6 + 2/3 + 2 1/3 = 50/12 ≈ 4.17 = answer A.

## Review
- [x] Triple-check: all 8 fixes validated via script
- [x] Re-scan: no remaining duplicate/equivalent answer choices (1 false positive confirmed harmless)
