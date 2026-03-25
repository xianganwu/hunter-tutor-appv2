# Assessment Stress Test — 10 Student Profiles

## Results: 142 tests pass, 0 failures

### Ranking Summary (from diagnostic output)

```
Name         Score     Range  Pctile    Conf Strong  Weak Missed
Aisha          100    97-100   ~99th    high     24     0      0
Iris            86     76-96   ~88th  medium     17     1      9
Brian           79     68-90   ~70th  medium     16     6     14
Diego           64     52-76   ~32nd  medium     12     9     22
Emma            60     48-72   ~32nd  medium      7     7     27
Chloe           53     40-66   ~15th  medium      7     9     33
Hugo            52     39-65   ~15th  medium      7    10     32
Grace           49     36-62    ~8th  medium      1    12     37
Javier          49     37-61    ~8th  medium      8     8     29
Felix           23     12-34    ~8th  medium      2    20     50
```

### Round 1: Exam Assembly — 8/8 pass
- [x] Correct question counts (~25 reading, ~19 QR, ~23 MA)
- [x] 3+ reading genres
- [x] Valid answer choices with correct answer present
- [x] No duplicate question IDs
- [x] Substantive writing prompt
- [x] Every reading block has passage text

### Round 2: Per-Student Scoring Sanity — 90/90 pass (9 checks x 10 students)
- [x] All section raw percentages in 0-100
- [x] All section weighted percentages in 0-100
- [x] correct <= total for every section
- [x] Missed question count = total - correct
- [x] Writing score matches input
- [x] Time analysis matches input
- [x] At least 1 recommendation per student
- [x] All skill classifications valid (strong/moderate/weak)
- [x] strongSkills all 'strong', weakSkills all 'weak'

### Round 3: Cross-Student Ordering — 5/5 pass
- [x] Aisha (perfect) has highest score
- [x] Felix (guesser) has lowest score
- [x] Expected relative ordering maintained
- [x] Percentiles follow same ordering as scores
- [x] Top 3 have more strong than weak skills; bottom 2 have more weak than strong

### Round 4: Confidence & Projection Quality — 22/22 pass
- [x] All confidence intervals valid (low <= est <= high)
- [x] All percentile ranges bracket point estimate
- [x] All students show high or medium confidence (67 questions = good precision)
- [x] Aisha (100%) has tighter range than Hugo (~50%)
- [x] Felix (20%) has tighter range than Emma (60%) — binomial SE smallest at extremes

### Round 5: Weighted vs Raw Divergence — 2/2 pass
- [x] Multiple sections show raw ≠ weighted (difficulty tiers working)
- [x] At least 5 divergences across 30 sections

### Round 6: Edge Cases — 6/6 pass
- [x] Grace (skips 40%): scores 45% overall (skipped = wrong)
- [x] Felix (guesser): scores 23/100, doesn't crash
- [x] Aisha (perfect): scores 100/100, 0 missed, doesn't crash
- [x] Javier (collapse): reading 84% >> MA 17%, pattern visible
- [x] Hugo (speed demon): used 14/35min reading, 7/17min QR
- [x] Iris (cautious): used 34/35min reading, 20.5/21min MA

### Round 7: Strength/Weakness Correctness — 6/6 pass
- [x] Chloe: strong reading skills, weak math skills
- [x] Diego: strong math skills, weak reading skills
- [x] Emma: >= 30% moderate classifications
- [x] Felix: >= 50% weak classifications
- [x] Aisha: >= 80% strong classifications
- [x] Brian: high reading/QR, low MA, weak skills in MA domain

### Confidence Assessment

With 67 MC questions, the binomial standard error model gives:
- At p=0.50 (Hugo): SE ≈ 6.1%, margin ≈ 13 pts → **medium confidence**
- At p=0.87 (Iris): SE ≈ 4.1%, margin ≈ 9 pts → **medium confidence**
- At p=1.00 (Aisha): SE ≈ 0%, margin ≈ 3 pts → **high confidence**
- At p=0.25 (Felix): SE ≈ 5.3%, margin ≈ 11 pts → **medium confidence**

The half-test's 67 questions deliver medium-confidence projections (±9-13 pts).
To reach high confidence (±8 pts) across all ability levels, need ~100+ questions
or real calibration data. This is an inherent trade-off of half-length format.
