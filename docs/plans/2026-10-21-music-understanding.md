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

## Authorized P0 follow-up

The user approved instrument coverage/latency and desktop frame-rate work, real independent recordings in Ego Lite, fixes, tests, commit and push. At this initial checkpoint model replacement required separate approval. Subsequent approvals cover mn04_as and mn05_as local screening and integration only after all gates pass; see the dated amendment below. No deployment, paid AI calls or additional frontend runtime is authorized. Retain the current AudioSession / FeaturePipeline / Workers / visualizer public interfaces.

- Classification: isolate model initialization, PCM availability, inference and temporal qualification. Use the previous corpus for development; freeze a separate recording manifest before inspecting its model results. Final acceptance uses distinct performances, counts unknown windows as failures, requires ≥80% correct coverage after the first three playback seconds and first correct evidence ≤5 seconds after audible onset for each recording. Speech/noise/silence must produce no instrument evidence. Keep raw score scale, competing/unsupported classes, freshness, source-reset and bounded-history safeguards.
- Rendering: compare raw requestAnimationFrame scheduling on an empty page, empty canvas and the real app, then isolate rendering, classification and comments. Optimize only measured application bottlenecks, preserve the five preset designs, reduced-motion support and actual draw-based metrics. Desktop acceptance remains a 30-minute session with ≥45 FPS in ≥95% complete one-second windows, all five presets, bounded resources and clean teardown.
- Verification: repeat independent recordings through the actual file → capture → Worker → model → visible local-comment path, then regress existing recordings and negative controls. Run relevant tests, lint/types, production build and release smoke. Keep production AI disabled and the existing upstream ledger unchanged. A model/runtime proposal, if necessary, must state the remaining failure and affected interfaces/resources for separate approval.

P0 candidate, pending native browser acceptance:

- Preserve the 15,600-sample model and use a 3,840-sample / 240 ms probe interval to catch short attacks between the previous 480 ms windows. One inference remains in flight and PCM remains bounded. Worker envelopes include measured processing time; the public `ModelResult` is unchanged.
- Retain the ≥0.08 observed peak floor and tentative wording. Bound temporal support to 12 observations / 2.5 seconds. Usual qualification requires ≥400 ms elapsed support. The quiet path uses the shortest recent suffix spanning ≥1.4 seconds and at least six windows, with Music ≥0.9 throughout, no voice-like score ≥0.1, mean ≥0.04, at least two scores ≥0.05, ≥70% scores ≥0.015, current ≥0.03 and a fourfold mean lead over supported and unsupported competitors. Earlier quiet tails do not delay sufficient recent support. These are heuristic qualification rules, not calibrated probabilities. Non-music clears history; dominant speech cannot keep a weak old instrument alive. Mark this algorithm `-temporal-2` while retaining reads of the previous provenance version.
- Configure canvas density before allocation, skip an unchanged deferred resize, and explicitly release each detached WebGL context after p5 removal. Keep visual resolution, shaders and five preset designs unchanged. The 45 FPS gate remains unpassed until actual browser measurements establish it.

### 2026-10-22 approved model-screening amendment

The user approved [mn04_as comparison](2026-10-22-p0-next-proposal.md) and then [mn05_as screening](2026-10-22-p0-model-followup.md), including necessary private local conversion dependencies and integration only after quality, response and resource gates pass. Neither candidate qualified; the production default remains YAMNet. The existing MediaPipe can run the converted private mn05 TFLite, so no frontend runtime was added. All model inference was local and the upstream AI ledger stayed unchanged.

The private candidate explicitly uses a versioned sample rate/window/hop and model-specific evidence profile, never shared score calibration across models. The mn05 experiment used 32 kHz / 64,000 samples / 12,800-sample hop, a fresh `max(Music, Musical instrument) >= .2` gate, and an established-label renewal correction verified against an independent temporal counterexample. Its final private input converter is Hann-windowed bandlimited sinc (16 zero crossings, .99 rolloff), rather than the production box-interval converter. Initial admission and freshness/reset/competition rules remain in force; raw class scores are not added or inflated. These changes have not been applied to app defaults or exported production interfaces.

If a future approved candidate passes, model specifications must reach FeaturePipeline and the classifier Worker together. Keep one classifier/in-flight call, model-rate PCM queue <1 MiB, continuous resampling phase with bounded filter state, latest complete window timing, source/reset invalidation and timeout degradation. Verify actual SDK and Worker integration privately before selecting the new app default. `ModelResult` / v2 and the single comment queue remain unchanged.

Nine YAMNet independent full-app recordings passed only 7/9. mn05 first six passed 5/6; after becoming exposed regression they helped isolate the renewal inconsistency. The corrected candidate passed old 21 positive regressions plus three negatives, but a newly frozen six passed only 4/6 and included historical guitar/ukulele confusion. No changes followed the final six. Source-window screening clocks are distinct from live capture/visible-comment clocks. Results, hashes and failed stages are in [model comparison](../../test/artifacts/p0-model-comparison-20261022.json) and [latest validation](../launch-validation.md).

The user selected Ego Lite background testing. Additional isolated tests still give about 29–30 FPS even for a 1x1 draw; do not claim the 45 FPS/95%/30-minute gate passed or substitute another browser without authorization. Power changes are temporary and restored. The user subsequently approved [mn10_as screening and local weight quantization](2026-10-22-p0-mn10-proposal.md). Its mixed-precision builtin TFLite fits 8 MiB and passes 27 exposed positive regressions plus three negative controls, but only 5/6 new frozen performances pass: historical Matilde is 75.34% with a 9.84s source-clock first identification. It is rejected for integration; no model/input/rule changes followed that holdout. The app default remains YAMNet, and complete SDK/Worker/visible-comment acceptance for mn10 is not claimed. [Measured stages](../../test/artifacts/p0-mn10-comparison-20261022.json).
- The nine-recording [holdout manifest](../../test/artifacts/p0-holdout-20261021.json) was frozen before observing predictions. It includes distinct GuitarSet performances and Commons jazz/historical guitar, two piano performances and two US Navy drum cadences. The [older native traces](../../test/artifacts/instrument-development-traces-20261022.json) are development regressions only. Do not relabel them as independent acceptance.

### 2026-10-22 repair amendment

The user approved continuing within the same mn10 pretrained weights, frozen new real recordings, no relaxed acceptance, no extra upstream calls/runtime, and commit/push only after required gates pass. The user also explicitly approved controlled1px background capture for the five-preset30min/95%-at45FPS check, retaining ordinary background~30FPS as a limitation.

The actual SDK candidate now uses fixed model-rate PCM, continuous resampling, correlated source epochs/requests, actual capture clocks, and cancellation/startup deadlines. One in-flight input plus the retained model PCM queue is measured separately from neural/WASM allocations. The C1 conditioner leaves playback and DSP/BPM unchanged. All these implementation details are experimental until the model's independent quality gate passes; the app default remains YAMNet.

Eight exposed real recordings passed coverage/visible-response in the SDK harness, but C1 passed only2/7 positives in the newly frozen v6 native test. The two real nonmusic controls produced no instruments. Same-input float/quantized max score error0.01773 and no coverage decline isolate quantization from the larger quality failure. Retain uncertainty about speech/noise boundaries in metadata-selected excerpts, with no post-prediction exclusions. Subsequent repeat/context probes are exposed development only and were rejected. See [consolidated evidence](../../test/artifacts/p0-mn10-repair-comparison-20261022.json).

The first controlled main-page soak failed early. A measured Mosaic hot path has since been repaired with original geometry, random sequence, color and ghost behavior preserved;160-frame deterministic and real-p5 pixel comparisons pass. The new full main-page soak is separate from model acceptance and must include all missing seconds and switches. The deployment target still needs its own Linux/HTTPS/proxy validation; no server model process or new frontend runtime is introduced.
## 2026-10-23 验证补记

最新结果以 [上线验收](../launch-validation.md) 和 [合并报告](../../test/artifacts/p0-mn10-repair-comparison-20261022.json) 为准。默认 YAMNet 已完成 1827.932 秒受控后台长测，五预设全部达标，完整秒 ≥45 FPS 比例 99.67%，64 次实际文件启停资源归零；此成绩不属于 mn10。DSP 派发期限时钟误用已修复；Next 已更新同系列安全补丁 16.4.2，生产审计零已知漏洞，186 项主回归和47项历史回归通过。

mn10 C1 按原冻结标注仍只有2/7演奏达到窗口门槛；两秒至四秒的渐增长上下文、传统谱减开发探针也未解决历史吉他，均未接入。未降低门槛、追加云端调用、添加推理运行时或部署，仍未 commit/push。后续换权重对照继续等待用户明确批准。已恢复接电低电量1、电池0，移除本地观察入口并重过普通构建与发布检查。
