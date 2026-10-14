# For platforms that prefer Docker (Koyeb, Fly.io, Cloud Run)
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py agents.py index.html agents.html agents.js portfolio.js dashboard.js ./
EXPOSE 8000
ENV PORT=8000
CMD ["python", "server.py"]

