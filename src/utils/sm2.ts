// Implementation of SM-2 Algorithm
// Based on: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm

export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

// Mapping buttons to grades:
// Again: 0 (Complete blackout) or 1 (Incorrect response; the correct one remembered)
// Hard: 2 (Incorrect response; where the correct one seemed easy to recall)
// Good: 3 (Correct response recalled with serious difficulty)
//       4 (Correct response after a hesitation)
// Easy: 5 (Perfect recall)
//
// Simplified for UI:
// Again -> 1
// Hard -> 2
// Good -> 4
// Easy -> 5

export interface ReviewResult {
    interval: number; // Days
    repetitions: number;
    easeFactor: number;
    nextReviewDate: number; // Timestamp
}

export function calculateReview(
    grade: Grade,
    currentInterval: number,
    currentRepetitions: number,
    currentEaseFactor: number,
    now: number = Date.now()
): ReviewResult {
    let nextInterval: number;
    let nextRepetitions: number;
    let nextEaseFactor: number;

    if (grade >= 3) {
        // Correct response
        if (currentRepetitions === 0) {
            nextInterval = 1;
            nextRepetitions = 1;
        } else if (currentRepetitions === 1) {
            nextInterval = 6;
            nextRepetitions = 2;
        } else {
            nextInterval = Math.round(currentInterval * currentEaseFactor);
            nextRepetitions = currentRepetitions + 1;
        }
    } else {
        // Incorrect response
        nextInterval = 1;
        nextRepetitions = 0;
    }

    // Update Ease Factor
    // EF' := EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    const q = grade;
    nextEaseFactor = currentEaseFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    
    // Minimum EF is 1.3
    if (nextEaseFactor < 1.3) nextEaseFactor = 1.3;

    // Calculate Next Review Date
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const nextReviewDate = now + (nextInterval * ONE_DAY_MS);

    return {
        interval: nextInterval,
        repetitions: nextRepetitions,
        easeFactor: nextEaseFactor,
        nextReviewDate
    };
}
