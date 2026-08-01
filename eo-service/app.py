"""
Jaiyq — EO зерттеу қызметі (ЖЕРГІЛІКТІ ҒАНА)
=============================================

⚠️ БҰЛ ҚЫЗМЕТ САЙТТЫҢ ӨНІМДІК НҰСҚАСЫНА ҚОСЫЛМАҒАН.

Сайт Vercel-де жүреді, ал бұл — машинадағы `localhost:8008`. Vercel
функциясы оған жете алмайды. Сондықтан бұл — зерттеу/тәжірибе құралы:
ашық (Apache-2.0) remote-sensing моделін жергілікті сынап көру үшін.

Не істейді: `AdaptLLM/remote-sensing-Qwen2-VL-2B-Instruct` моделіне спутник
суретін беріп, көзге көрінетін нәрселерді сипаттатады.

⚠️ ШЕКТЕУЛЕРІ — бұларды білмей нәтижесіне сенуге БОЛМАЙДЫ:

1. Модель remote-sensing VQA деректерінде (RSVQA т.б.) оқытылған — «жолда
   неше көлік бар?», «ғимарат бар ма?» сияқты сұрақтарға. Ол мұнай
   ластануын, заңсыз қоқысты, жер деградациясын анықтауға оқытылмаған.
   Ондай сұрақ қойсаң, сенімді естілетін, бірақ негізсіз мәтін жазады.
2. Кіріс — Mapbox RGB тайлы: түсі эстетика үшін түзетілген, түсірілім күні
   белгісіз, спектр каналдары жоқ. Одан ластану туралы қорытынды шығару
   физикалық тұрғыдан мүмкін емес.

Сондықтан промпт әдейі шектелген: модельден тек КӨРІНЕТІН беткі қабат
элементтерін сипаттау сұралады, ешқандай экологиялық диагноз сұралмайды.

Нақты, өлшенетін экологиялық нәтиже керек болса — `/api/flood-extent`
эндпоинтін қара (Sentinel-1 SAR, сайттың ішінде, өнімде жұмыс істейді).

Іске қосу:
    cd eo-service
    python3 -m venv venv && source venv/bin/activate
    pip install -r requirements.txt
    uvicorn app:app --host 127.0.0.1 --port 8008

Бірінші сұраныста салмақтар (~4.4 ГБ) Hugging Face-тен жүктеледі де,
`~/.cache/huggingface` ішінде қалады.
"""

from __future__ import annotations

import io
import logging
import os
import time
from contextlib import asynccontextmanager
from threading import Lock
from typing import Optional
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("jaiyq-eo-service")

MODEL_ID = "AdaptLLM/remote-sensing-Qwen2-VL-2B-Instruct"
MODEL_LABEL = "AdaptLLM remote-sensing-Qwen2-VL-2B (Apache-2.0, жергілікті)"

# --- Қауіпсіздік ------------------------------------------------------------
# Кез келген URL-ды жүктеу SSRF-ке жол ашады: шақырушы қызметке ішкі
# мекенжайларды (бұлт метадеректері, роутер, localhost сервистері)
# жүктетіп, жауабын оқи алады. Сондықтан хосттар тізімі шектеулі.
ALLOWED_IMAGE_HOSTS = {
    "api.mapbox.com",
    "sh.dataspace.copernicus.eu",
    "services.sentinel-hub.com",
}
MAX_IMAGE_BYTES = 12 * 1024 * 1024  # 12 МБ
MAX_IMAGE_PIXELS = 4096 * 4096
# Браузердегі кез келген бет localhost:8008-ге сұраныс жібере алмауы үшін
ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

_model = None
_processor = None
_device = "cpu"
_load_lock = Lock()
_load_error: Optional[str] = None


def _load_model() -> None:
    global _model, _processor, _device, _load_error
    with _load_lock:
        if _model is not None or _load_error is not None:
            return
        try:
            import torch
            from transformers import AutoProcessor, Qwen2VLForConditionalGeneration

            if torch.cuda.is_available():
                _device, dtype = "cuda", torch.bfloat16
            elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
                # Apple Silicon. float32-де 2B модель ~8.8 ГБ RAM жейді де,
                # Air сияқты машинада swap-қа түсіп қатып қалады. bfloat16 —
                # екі есе аз (~4.4 ГБ) әрі MPS-те қолдау бар.
                _device, dtype = "mps", torch.bfloat16
            else:
                _device, dtype = "cpu", torch.float32

            log.info("Loading %s on %s (%s) ...", MODEL_ID, _device, dtype)
            t0 = time.time()
            _processor = AutoProcessor.from_pretrained(MODEL_ID)
            _model = Qwen2VLForConditionalGeneration.from_pretrained(
                MODEL_ID, torch_dtype=dtype
            ).to(_device)
            _model.eval()
            log.info("Model loaded in %.1fs", time.time() - t0)
        except Exception as e:  # noqa: BLE001
            log.exception("Model load failed")
            _load_error = str(e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import threading

    threading.Thread(target=_load_model, daemon=True).start()
    yield


app = FastAPI(
    title="Jaiyq EO Research Service",
    description="Жергілікті зерттеу құралы. Өнімдік сайтқа қосылмаған.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class DescribeRequest(BaseModel):
    imageUrl: str = Field(..., description="Спутник суретінің URL-ы (рұқсат етілген хосттан)")
    lang: str = Field("kk", pattern="^(kk|ru|en)$")
    question: Optional[str] = Field(None, max_length=500)


class DescribeResponse(BaseModel):
    description: str
    model: str
    source: str
    device: str
    latencyMs: int
    caveat: str


CAVEAT = (
    "Бұл — жалпы мақсаттағы ашық модельдің суретті СИПАТТАУЫ, валидацияланған "
    "экологиялық анықтау ЕМЕС. Диагноз ретінде пайдалануға жарамайды."
)

# Промпт әдейі шектелген: тек көрінетін беткі қабат элементтері сұралады.
# Модельден «мұнай ластануы бар ма?» деп сұрау — оның оқытылу аясынан тыс,
# нәтижесі негізсіз болады.
PROMPTS = {
    "kk": (
        "Бұл — спутниктік сурет (Атырау облысы, Қазақстан). Суретте КӨЗГЕ "
        "КӨРІНЕТІН беткі қабат элементтерін ғана сипатта: су айдындары, "
        "өсімдік жамылғысы, ашық топырақ, жолдар, ғимараттар, өнеркәсіп "
        "нысандары. Тек көргеніңді айт, себебін немесе салдарын болжама. "
        "Қазақ тілінде, 2-4 сөйлем."
    ),
    "ru": (
        "Это спутниковый снимок (Атырауская область, Казахстан). Опиши только "
        "ВИДИМЫЕ элементы поверхности: водоёмы, растительность, открытая почва, "
        "дороги, здания, промышленные объекты. Говори только о том, что видишь, "
        "не делай выводов о причинах. По-русски, 2-4 предложения."
    ),
    "en": (
        "This is a satellite image (Atyrau region, Kazakhstan). Describe only "
        "the VISIBLE surface features: water bodies, vegetation, bare soil, "
        "roads, buildings, industrial structures. State only what you see; do "
        "not infer causes. In English, 2-4 sentences."
    ),
}


def _fetch_image(url: str) -> Image.Image:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise HTTPException(400, "Тек https рұқсат етілген")
    if parsed.hostname not in ALLOWED_IMAGE_HOSTS:
        raise HTTPException(
            400,
            f"Хост рұқсат етілмеген: {parsed.hostname}. "
            f"Рұқсат етілгендер: {', '.join(sorted(ALLOWED_IMAGE_HOSTS))}",
        )
    try:
        resp = requests.get(url, timeout=15, stream=True)
        resp.raise_for_status()
        data = resp.raw.read(MAX_IMAGE_BYTES + 1, decode_content=True)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Суретті алу мүмкін болмады: {e}")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Сурет тым үлкен (12 МБ шегі)")
    try:
        image = Image.open(io.BytesIO(data))
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise HTTPException(413, "Сурет ажыратымдылығы тым жоғары")
        return image.convert("RGB")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Сурет форматы танылмады: {e}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "modelLoaded": _model is not None,
        "loadError": _load_error,
        "device": _device,
        "productionUse": False,
        "note": "Жергілікті зерттеу құралы. Сайттың өнімдік нұсқасында қолданылмайды.",
    }


@app.post("/describe", response_model=DescribeResponse)
def describe(req: DescribeRequest):
    if _load_error is not None:
        raise HTTPException(503, f"Модель жүктелмеді: {_load_error}")
    if _model is None:
        raise HTTPException(
            503, "Модель әлі жүктелуде (бірінші рет ~4.4 ГБ). /health арқылы тексер."
        )

    image = _fetch_image(req.imageUrl)
    prompt = req.question or PROMPTS.get(req.lang, PROMPTS["kk"])

    import torch
    from qwen_vl_utils import process_vision_info

    messages = [
        {
            "role": "user",
            "content": [{"type": "image", "image": image}, {"type": "text", "text": prompt}],
        }
    ]
    text = _processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = _processor(
        text=[text], images=image_inputs, videos=video_inputs,
        padding=True, return_tensors="pt",
    ).to(_device)

    t0 = time.time()
    with torch.no_grad():
        generated = _model.generate(**inputs, max_new_tokens=120)
    trimmed = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated)]
    output_text = _processor.batch_decode(
        trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )[0]

    return DescribeResponse(
        description=output_text.strip(),
        model=MODEL_ID,
        source=MODEL_LABEL,
        device=_device,
        latencyMs=int((time.time() - t0) * 1000),
        caveat=CAVEAT,
    )


if __name__ == "__main__":
    import uvicorn

    # 127.0.0.1 — әдейі: 0.0.0.0 қызметті бүкіл жергілікті желіге ашады
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8008")))
