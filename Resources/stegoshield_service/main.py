import io
import os
import math
import json
import time
import base64
import random
import hashlib
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from PIL import Image, ExifTags
import numpy as np
import pytesseract
import cv2

import pytesseract

# Explicit path to the tesseract.exe binary
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


app = FastAPI(title="StegoShield Service", version="0.1.0")

SCORE_BLOCK = 0.85
SCORE_QUARANTINE = 0.55
METADATA_SUSPICION_KEYS = ["comment", "UserComment", "XPComment", "ImageDescription"]
SUSPICIOUS_KEYWORDS = [
    "ignore", "download", "secret", "password", "execute", "run", "open", "leak", "exfiltrate"
]


def shannon_entropy(arr: np.ndarray) -> float:
    hist = np.bincount(arr.flatten(), minlength=256).astype(float)
    probs = hist / (hist.sum() + 1e-12)
    probs = probs[probs > 0]
    return float(-np.sum(probs * np.log2(probs + 1e-12)))


def lsb_entropy_score(img: Image.Image) -> float:
    g = np.array(img.convert("L"), dtype=np.uint8)
    lsb = (g & 1).flatten()
    p1 = lsb.mean()
    if p1 in (0.0, 1.0):
        return 0.0
    return float(- (p1 * math.log2(p1) + (1 - p1) * math.log2(1 - p1)))


def jpeg_blockiness_score(img: Image.Image) -> float:
    arr = np.array(img.convert("L"), dtype=np.float32)
    h, w = arr.shape
    if h < 16 or w < 16:
        return 0.0
    diffs = []
    for x in range(8, w, 8):
        diffs.append(np.mean(np.abs(arr[:, x] - arr[:, x - 1])))
    for y in range(8, h, 8):
        diffs.append(np.mean(np.abs(arr[y, :] - arr[y - 1, :])))
    if not diffs:
        return 0.0
    norm = np.mean(np.abs(arr - arr.mean())) + 1e-6
    return float(np.mean(diffs) / norm)


def metadata_flags(img: Image.Image):
    flags = []
    try:
        exif = img.getexif()
        if exif:
            for tag_id, value in exif.items():
                tag = ExifTags.TAGS.get(tag_id, tag_id)
                if tag in METADATA_SUSPICION_KEYS:
                    flags.append(f"meta_field:{tag}")
                if isinstance(value, (bytes, bytearray)):
                    flags.append(f"meta_raw_bytes:{tag}")
                if isinstance(value, str) and len(value) > 512:
                    flags.append(f"meta_long:{tag}")
    except Exception:
        pass
    try:
        info = img.info or {}
        for k, v in info.items():
            if k.lower() in METADATA_SUSPICION_KEYS or (isinstance(v, str) and len(v) > 512):
                flags.append(f"png_info:{k}")
    except Exception:
        pass
    return list(set(flags))


def ocr_with_boxes(img: Image.Image):
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    texts, boxes, suspicious = [], [], []
    for i in range(len(data['text'])):
        txt = str(data['text'][i]).strip()
        if txt:
            x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
            boxes.append((x, y, w, h, txt))
            texts.append(txt)
            if any(k in txt.lower() for k in SUSPICIOUS_KEYWORDS):
                suspicious.append((x, y, w, h, txt))
    return texts, boxes, suspicious


def rdr_inconsistency_score(img: Image.Image, num_resamples: int = 5):
    def _random_resample(_img: Image.Image) -> str:
        scale = random.uniform(0.6, 1.3)
        method = random.choice([Image.BICUBIC, Image.BILINEAR, Image.NEAREST])
        new_w = max(32, int(_img.width * scale))
        new_h = max(32, int(_img.height * scale))
        rendered = _img.resize((new_w, new_h), method)
        return pytesseract.image_to_string(rendered).strip()

    texts = []
    for _ in range(num_resamples):
        try:
            t = _random_resample(img)
            if t:
                texts.append(t)
        except Exception:
            pass
    if not texts:
        return 0.0, []
    count_susp = sum(1 for t in texts if any(k in t.lower() for k in SUSPICIOUS_KEYWORDS))
    frac = count_susp / max(1, len(texts))
    if count_susp > 0 and frac < 0.7:
        inconsistency = 0.5 + (0.5 * (1 - frac))
    elif count_susp > 0:
        inconsistency = 0.4 * frac
    else:
        inconsistency = 0.0
    suspicious_texts = [t for t in texts if any(k in t.lower() for k in SUSPICIOUS_KEYWORDS)]
    return float(inconsistency), suspicious_texts


def embed_watermark_dct_bytes(img_bytes: bytes, message: str, alpha: int = 4):
    npimg = np.frombuffer(img_bytes, np.uint8)
    bgr = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Cannot decode image")
    ycbcr = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb).astype(np.float32)
    y = ycbcr[:, :, 0]
    h, w = y.shape
    ph = (8 - (h % 8)) % 8
    pw = (8 - (w % 8)) % 8
    y_p = np.pad(y, ((0, ph), (0, pw)), mode='reflect')
    bh, bw = y_p.shape[0] // 8, y_p.shape[1] // 8
    msg_b64 = base64.b64encode(message.encode('utf-8')).decode('ascii')
    bits = ''.join(format(b, '08b') for b in msg_b64.encode('ascii'))
    bits = bits[: bh * bw]
    if not bits:
        raise ValueError("Message empty or host too small")
    bit_idx = 0
    for i in range(bh):
        for j in range(bw):
            if bit_idx >= len(bits):
                break
            block = y_p[i * 8:(i + 1) * 8, j * 8:(j + 1) * 8]
            d = cv2.dct(block)
            r, c = 1, 0
            coeff_int = int(np.round(d[r, c]))
            bit = int(bits[bit_idx])
            if (coeff_int % 2) != bit:
                if coeff_int >= 0:
                    d[r, c] = coeff_int + alpha
                else:
                    d[r, c] = coeff_int - alpha
            y_p[i * 8:(i + 1) * 8, j * 8:(j + 1) * 8] = cv2.idct(d)
            bit_idx += 1
        if bit_idx >= len(bits):
            break
    y_wm = y_p[:h, :w]
    ycbcr[:, :, 0] = y_wm
    out_bgr = cv2.cvtColor(ycbcr.astype(np.uint8), cv2.COLOR_YCrCb2BGR)
    _, enc = cv2.imencode('.png', out_bgr)
    return enc.tobytes(), msg_b64


def file_sha256_bytes(data: bytes) -> str:
    sha = hashlib.sha256()
    sha.update(data)
    return sha.hexdigest()


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    purger_ncomp: Optional[int] = Form(0),
    watermark_enabled: Optional[bool] = Form(False),
    watermark_msg: Optional[str] = Form("stegoshield-demo")
):
    try:
        raw = await file.read()
        img = Image.open(io.BytesIO(raw)).convert('RGB')

        res = {
            "path": file.filename,
            "sha256": file_sha256_bytes(raw)
        }

        flags = metadata_flags(img)
        res["metadata_flags"] = flags
        res["lsb_entropy"] = lsb_entropy_score(img)
        res["global_entropy"] = shannon_entropy(np.array(img.convert("L")))
        res["blockiness"] = jpeg_blockiness_score(img)

        texts, boxes, suspicious_boxes = ocr_with_boxes(img)
        res["ocr_texts"] = texts
        res["ocr_suspicious"] = [b[-1] for b in suspicious_boxes]

        rdr_score, rdr_sus = rdr_inconsistency_score(img)
        res["rdr_score"] = rdr_score
        res["rdr_examples"] = rdr_sus

        score = (0.35 * res["lsb_entropy"] + 0.15 * (res["global_entropy"] / 8.0) +
                 0.25 * res["blockiness"] + (0.6 if flags else 0.0))
        res["stego_score"] = float(max(0.0, min(1.0, score)))

        decision = "ALLOW"
        if res["stego_score"] >= SCORE_BLOCK:
            decision = "BLOCK"
        elif res["stego_score"] >= SCORE_QUARANTINE:
            decision = "SUSPICIOUS"
        if rdr_score >= 0.5:
            decision = "SUSPICIOUS" if decision == "ALLOW" else "BLOCK"
        if suspicious_boxes and decision != "BLOCK":
            decision = "SUSPICIOUS"

        res["decision"] = decision

        if watermark_enabled and decision == "ALLOW":
            try:
                wm_bytes, msg_b64 = embed_watermark_dct_bytes(raw, watermark_msg or "stegoshield-demo")
                res["watermarked_base64"] = base64.b64encode(wm_bytes).decode('ascii')
                res["watermark_message"] = msg_b64
            except Exception as e:
                res["watermark_error"] = str(e)

        return JSONResponse(res)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


