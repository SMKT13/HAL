# For platforms that prefer Docker (Koyeb, Fly.io, Cloud Run)
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py index.html ./
EXPOSE 8000
ENV PORT=8000
CMD ["python", "server.py"]
