from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SourceVideo(BaseModel):
    originalFileName: str
    storagePath: str
    contentType: str
    size: int


class RuntimeOptions(BaseModel):
    timeoutMillis: int = Field(default=5000, ge=1)


class AnalyzeRequest(BaseModel):
    schemaVersion: str = "v1"
    analysisPhase: str
    sourceVideo: SourceVideo
    runtime: RuntimeOptions


class AnalyzeResponse(BaseModel):
    provider: str
    analyzerName: str
    signature: int
    sampleCount: int
    durationMs: int
    notes: list[str]
    landmarks: list[dict[str, Any]]
    extras: dict[str, Any]
