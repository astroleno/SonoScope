# Music understanding iteration — 2026-10-21

Scope: strengthen specific instrument evidence, tempo on recorded music, and comments tied to those observations. Test in Ego Lite, fix regressions, commit and push. Do not deploy. This continues the approved AudioSession / FeaturePipeline / two Workers / one comment queue / v2 generation architecture.

## Modules and interfaces

| Module | Responsibility | Interface preserved |
| --- | --- | --- |
| AudioSession compatibility capture | Advance audio time by the actual sample count across late/duplicate callback timestamps; retain real discontinuities | `capture(..., onPCM(pcm, audioTime))`; source ownership and teardown preserved |
| Model Worker and FeaturePipeline | Feed complete model windows; aggregate categories by class and time; reject padding and unstable/unsupported instrument guesses | `classify { pcm, sampleRate, capturedAt }` → `ModelResult { categories, voiceProbability, instrument }`; null means unknown |
| Core DSP | Track periodic onset evidence over a bounded history, distinguish subdivisions and silence, avoid confident tempo from a few note attacks | `FeatureExtractor.extract()` → `AudioValues.tempo { bpm, confidence } \| null`; `FeatureSnapshot.stats.tempo` |
| Danmu controller | Emit instrument-specific local observations after stable fresh evidence, and tempo observations after sufficient evidence; expire evidence across source changes | `feedFrame()` and the existing bounded, deduplicated comment queue |
| Server evidence and prompt | Prioritize supported instrument/tempo facts; retain rejection of unsupported instruments, vocals, pitch, temporal changes, and raw DSP jargon | Strict v2 request and NDJSON response; 5 regular plus 1–2 companionship comments, each 8–24 characters |

No new cloud audio upload, runtime, or public contract is implied. If the existing model cannot meet the instrument criteria, document its failure and assess the affected model design before introducing another model.

## Investigation and acceptance

1. Preserve baseline raw classifier results, including chunk timestamps, class IDs and scores. Verify the suspected extra padded chunk and avoid treating pooled duplicate labels as independent evidence. Use the pinned MediaPipe package and checked model assets.
2. Use public real recordings with provenance: at least piano, guitar and drums/percussion, with independent excerpts for calibration and validation. Target stable correct dominant-instrument evidence on at least 80% of eligible validation windows, and first stable evidence within 5 seconds. Report coverage separately from correctness; unknown is not a correct identification. Speech, noise and silence must not yield a specific instrument. This does not promise full polyphonic source separation.
3. Validate real-music tempo against published beat timestamps, not filename BPM or another estimator. Use at least three recordings, two tempos and two performances. Target at most 3% BPM error after 8 seconds in at least 80% of eligible stable windows. Report exact, half/double-time and unknown separately; octave errors do not count as exact successes. Retain synthetic 60/90/120/150/180 BPM regressions, silence reset and source discontinuity checks.
4. Show instrument-specific local comments for supported instruments in the real app. A specific comment must refer to fresh evidence and appear within 1 second of an eligible observation unless queue spacing applies. Verify tempo-specific text only when reliable, switching sources clears previous evidence, and no instrument/tempo assertion appears on negative controls.
5. Verify native browser inference and full audio → features → queue → visible comment behavior in Ego Lite. Preserve raw results privately and a concise source-backed public report. Do not count injected classifications as real-model tests.
6. Run relevant regressions, types, lint, production build and release smoke. Record remaining failures rather than redefining thresholds. The previous 45 FPS acceptance remains open; this iteration does not waive it.

## Real AI allowance

The previous local test ledger has 30 settled upstream calls. The user explicitly approved six additional calls on 2026-10-21: retain that ledger and raise its daily cap to 36, with concurrency 1 and the unchanged cumulative 200,000-token ceiling. No uncounted retries or top-ups. The enabled configuration is private and bound to loopback for testing; production AI remains disabled.

## Implementation decisions

- Feed 15,600 samples at 16 kHz per model window with a 7,680-sample hop. Keep at most two windows during loading/inference, account for the original window end time, and retain one inference in flight. Ignore incomplete padded classification chunks and merge by class rather than summing correlated parent/child labels.
- Qualify instrument candidates across at most six windows / 2.5 seconds. Preserve the observed rolling peak as the score, without probability inflation. Low scores require the `-temporal-1` provenance suffix and tentative wording. The cautious path requires six windows with Music ≥0.9, no voice-like category ≥0.1, a mean score ≥0.08, five supporting windows, and a fourfold lead over competing instruments. Unsupported instruments also compete; weak ambiguity stays unknown.
- Use a 100 Hz onset envelope over at most 12 seconds for musical periodicity, with a tempo prior, several autocorrelation lags, ambiguity rejection, and eight stable analyses. A recently established rate may re-enter within one second only after current non-ambiguous evidence supports it; confidence comes from the new evidence. A real time gap, rewind, or sustained silence resets the history.
- Keep a sample clock for compatibility capture across repeated or delayed `playbackTime` values. A deviation beyond two buffer durations re-anchors the clock, preserving real discontinuities. Native Worklet timestamps are unchanged.
- Give the provider structured observation priorities, required tentative prefixes, and forbidden topics. Retain server rejection of unsupported instruments and fabricated BPM, pitch/harmony or temporal comparisons. Real accepted outputs are retained as offline regression fixtures.

## Outcome and open acceptance

See [the validation report](../music-understanding-validation-2026-10-21.md) and [measured evidence](../../test/artifacts/local-music-understanding-20261021.json). Automated regressions and the recorded local feedback path pass. The expanded guitar corpus still has coverage and first-identification failures, and the existing desktop 45 FPS gate remains open. These thresholds have not been waived; this iteration does not establish full launch readiness.

## Primary references

- MediaPipe: [web Audio Classifier](https://developers.google.com/edge/mediapipe/solutions/audio/audio_classifier/web_js) and [model overview](https://developers.google.cn/edge/mediapipe/solutions/audio/audio_classifier/index). The shipped model has 15,600 input samples at 16 kHz; the API can return multiple timestamped chunks.
- TensorFlow: [YAMNet tutorial](https://www.tensorflow.org/hub/tutorials/yamnet), which aggregates scores by class across frames rather than pooling classes from separate timestamps.
- [GuitarSet v1.1.0](https://zenodo.org/records/3371780): real acoustic-guitar performances and time-aligned beat annotations, CC BY 4.0. Check the published known annotation errors when selecting test recordings.
