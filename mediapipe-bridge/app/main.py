from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .analysis import analyze_payload
from .schemas import AnalyzeRequest, AnalyzeResponse


app = FastAPI(
    title="Mocha MediaPipe Bridge",
    version="0.2.0",
    description="FastAPI bridge for Mocha motion analysis using real MediaPipe extraction only.",
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"errorCode": "HTTP_ERROR", "message": str(exc.detail)}
    print(
        "[bridge-error]",
        f"status={exc.status_code}",
        f"errorCode={detail.get('errorCode')}",
        f"message={detail.get('message')}",
        flush=True,
    )
    return JSONResponse(status_code=exc.status_code, content=detail)


@app.exception_handler(Exception)
async def unexpected_exception_handler(_, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "errorCode": "BRIDGE_UNEXPECTED_ERROR",
            "message": str(exc) or "Unexpected bridge error.",
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "UP"}


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    print(
        "[bridge-request]",
        f"phase={payload.analysisPhase}",
        f"file={payload.sourceVideo.originalFileName}",
        f"path={payload.sourceVideo.storagePath}",
        f"size={payload.sourceVideo.size}",
        flush=True,
    )
    return analyze_payload(payload)
