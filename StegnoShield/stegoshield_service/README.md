StegoShield Service

Run locally:

1. Install system dependency: tesseract-ocr
2. Create venv, install `requirements.txt`
3. Start: `uvicorn main:app --host 0.0.0.0 --port 8001`

The Node backend forwards `POST /api/stegoshield/analyze` to this service.
