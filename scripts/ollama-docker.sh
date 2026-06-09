#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="${OLLAMA_MODEL:-llama3:latest}"
cd "$ROOT"

if curl -sf "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
  echo "Port 11434 is already in use."
  echo "Stop the native Ollama app or any other service on 11434 before starting Docker Ollama."
  exit 1
fi

echo "Starting Ollama in Docker..."
docker compose up -d

echo "Waiting for Ollama to become healthy..."
until curl -sf "http://127.0.0.1:11434/api/tags" >/dev/null; do
  sleep 2
done

echo "Pulling model: ${MODEL}"
docker compose exec ollama ollama pull "${MODEL}"

echo ""
echo "Ollama is ready at http://127.0.0.1:11434"
echo "Model: ${MODEL}"
echo ""
echo "Next:"
echo "  cd app && npm start"
