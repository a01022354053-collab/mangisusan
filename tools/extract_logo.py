"""
만기수산 로고 추출 스크립트
---------------------------------------------------------------
원본 대표 이미지(logo.png)에서 '만기수산' 붓글씨와 붉은 '민물장어' 도장만
투명 배경 PNG/WebP 로 분리합니다. 글씨를 새로 그리거나 모양을 바꾸지 않고,
원본 픽셀에서 흰 배경만 투명하게 바꾸고 주변 장어·물보라를 걷어 냅니다.

실행:  python3 tools/extract_logo.py
필요:  pip install pillow numpy scipy
결과:  assets/img/logo-mangisusan.png / .webp (한 장)
       assets/img/logo-text.webp, logo-seal.webp (등장 애니메이션용으로 나눈 것)
       assets/img/favicon-32.png, apple-touch-icon.png (도장 부분)
원본 디자인 파일(AI·PSD 등)을 받으면 그 파일로 교체하는 것이 가장 정확합니다.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "logo.png"
OUT = ROOT / "assets" / "img"

# 원본(1672×941) 기준 영역
TEXT_BOX = (310, 680, 280, 1175)   # y0, y1, x0, x1 — '만기수산' 붓글씨
SEAL_BOX = (290, 610, 1160, 1480)  # 붉은 원형 도장 + '민물장어'
EYE_BOX = (290, 400, 1200, 1300)   # 도장 속 장어 머리의 흰 눈


def box(shape, y0, y1, x0, x1):
    m = np.zeros(shape, bool)
    m[y0:y1, x0:x1] = True
    return m


def main():
    src = Image.open(SRC).convert("RGB")
    a = np.asarray(src).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx, mn = a.max(2), a.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    shape = lum.shape

    # 1) 붓글씨: 아주 어둡고 채도가 낮은 픽셀. 글자 아래에서 시작하는 덩어리(장어 몸통)는 제외
    text = (lum < 70) & (sat < 0.45) & box(shape, *TEXT_BOX)
    lab, _ = ndi.label(text)
    keep_text = np.zeros_like(text)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        comp = lab[sl] == i
        if comp.sum() < 40 or sl[0].start > 600:
            continue
        keep_text[sl] |= comp

    # 2) 도장: 붉은 픽셀 + 그 안의 검은 '민물장어' 글씨
    seal = box(shape, *SEAL_BOX)
    red = (r > 110) & (g < 90) & (b < 90) & (r - g > 60) & seal
    seal_text = (lum < 80) & (sat < 0.45) & seal

    # 3) 가장자리 부드러움 유지: 핵심 영역을 2px 넓힌 범위 안에서 흰색 → 투명 변환
    core = keep_text | red | seal_text
    keep = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    alpha = np.clip((255 - mn) / 255.0, 0, 1) * keep

    # 4) 장어 머리의 흰 눈은 투명해지지 않도록 흰색 그대로 유지
    filled = ndi.binary_fill_holes(ndi.binary_closing(red | seal_text, iterations=2) & box(shape, *EYE_BOX))
    eye = filled & ~red & ~seal_text & (lum > 150)

    out = np.zeros((*shape, 4), np.float32)
    safe = np.maximum(alpha, 1e-6)[..., None]
    out[..., :3] = np.clip((a - 255 * (1 - alpha[..., None])) / safe, 0, 255)
    out[..., 3] = alpha * 255
    out[eye] = [255, 255, 255, 255]

    logo = Image.fromarray(out.astype(np.uint8), "RGBA")
    bbox = logo.getbbox()
    logo = logo.crop(bbox)
    logo.save(OUT / "logo-mangisusan.png", optimize=True)
    logo.save(OUT / "logo-mangisusan.webp", "WEBP", quality=90, method=6)

    # 등장 애니메이션용: 붓글씨와 도장을 같은 높이로 나눠 저장 (위치·크기 그대로)
    cols = np.asarray(logo)[..., 3].sum(axis=0)
    seal_left = SEAL_BOX[2] - bbox[0]
    gap = [x for x in range(seal_left - 40, seal_left + 15) if cols[x] == 0]
    split = gap[len(gap) // 2] if gap else seal_left
    logo.crop((0, 0, split, logo.height)).save(OUT / "logo-text.webp", "WEBP", quality=90, method=6)
    logo.crop((split, 0, logo.width, logo.height)).save(OUT / "logo-seal.webp", "WEBP", quality=90, method=6)
    print(f"split at {split}px = {split / logo.width * 100:.3f}% of {logo.width}x{logo.height}")

    # 도장만 잘라 파비콘(흰 바탕 원형 느낌을 살리기 위해 흰 배경 위에 배치)
    sx0, sy0 = SEAL_BOX[2] - bbox[0], SEAL_BOX[0] - bbox[1]
    seal_img = logo.crop((max(0, sx0), max(0, sy0), logo.width, logo.height))
    seal_img = seal_img.crop(seal_img.getbbox())
    side = max(seal_img.size) + 24
    for name, size in (("apple-touch-icon.png", 180), ("favicon-32.png", 32), ("favicon-192.png", 192)):
        canvas = Image.new("RGBA", (side, side), (255, 255, 255, 255))
        canvas.alpha_composite(seal_img, ((side - seal_img.width) // 2, (side - seal_img.height) // 2))
        canvas.convert("RGB").resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)

    print("logo", logo.size, "seal", seal_img.size)


if __name__ == "__main__":
    main()
