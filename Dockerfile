FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg iputils-ping net-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY web ./web
COPY run.py config.yaml .env.example ./
COPY data/floors.json data/layout.json ./defaults/

# data/ est un volume : on y copie le plan par défaut au premier lancement
CMD ["sh", "-c", "mkdir -p data && for f in defaults/*.json; do [ -f data/$(basename $f) ] || cp $f data/; done; [ -f .env ] || cp .env.example .env; exec python -m app.main"]
EXPOSE 8123
