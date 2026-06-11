# Room-ID eval holdout photos

Drop labeled holdout JPEGs here and register them in
`src/eval/roomEvalAssets.ts` (instructions in that file). They're run through
the real on-device CLIP room-identification pipeline from the Debug screen's
"Room-ID eval" panel. Include a few photos that must NOT match any room
(`expected: null`) to test the abstain path.
