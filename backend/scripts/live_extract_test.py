import asyncio
import sys
import time
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.video_extractor import extract_video

SHARE = sys.argv[1] if len(sys.argv) > 1 else (
    "https://v.douyin.com/EVF_YHF2uB0/"
)


async def main():
    t0 = time.time()
    result = await extract_video(SHARE)
    elapsed = round(time.time() - t0, 2)
    print(f"elapsed={elapsed}s")
    if result is None:
        print("status=FAILED")
        return 1
    print(f"status=OK video_id={result.video_id}")
    print(f"author={result.author}")
    print(f"source={result.source}")
    print(f"likes={result.likes}")
    print(f"transcript_len={len(result.transcript)}")
    print(f"transcript_preview={result.transcript[:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
