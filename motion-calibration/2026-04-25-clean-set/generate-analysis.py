from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BRIDGE_ROOT = ROOT / "mediapipe-bridge"
SET_ROOT = Path(__file__).resolve().parent
OUTPUT_ROOT = SET_ROOT / "analysis"

sys.path.insert(0, str(BRIDGE_ROOT))

from app.analysis import analyze_payload  # noqa: E402
from app.schemas import AnalyzeRequest, RuntimeOptions, SourceVideo  # noqa: E402


SAMPLES = (
    ("reference", SET_ROOT / "reference" / "reference-01.mp4", "reference-analysis.json"),
    ("attempt", SET_ROOT / "attempts" / "strong-01.mp4", "attempt-strong-analysis.json"),
    ("attempt", SET_ROOT / "attempts" / "similar-01.mp4", "attempt-similar-analysis.json"),
    ("attempt", SET_ROOT / "attempts" / "wrong-01.mp4", "attempt-wrong-analysis.json"),
    ("attempt", SET_ROOT / "attempts" / "static-01.mp4", "attempt-static-analysis.json"),
    ("attempt", SET_ROOT / "attempts" / "low-confidence-01.mp4", "attempt-low-confidence-analysis.json"),
)


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    for phase, video_path, output_name in SAMPLES:
        if not video_path.exists():
            print(f"[skip] missing {video_path}")
            continue

        print(f"[analyze] {video_path.name}")
        payload = AnalyzeRequest(
            schemaVersion="v1",
            analysisPhase=phase,
            sourceVideo=SourceVideo(
                originalFileName=video_path.name,
                storagePath=str(video_path),
                contentType="video/mp4",
                size=video_path.stat().st_size,
            ),
            runtime=RuntimeOptions(timeoutMillis=35000),
        )
        response = analyze_payload(payload)
        output_path = OUTPUT_ROOT / output_name
        output_path.write_text(
            json.dumps(response.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(
            "[done]",
            output_path,
            f"samples={response.sampleCount}",
            f"durationMs={response.durationMs}",
        )


if __name__ == "__main__":
    main()
