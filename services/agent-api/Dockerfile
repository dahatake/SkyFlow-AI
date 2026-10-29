# syntax=docker/dockerfile:1
# Build context: services/agent-api.  docker build -t skyflow-agent-api services/agent-api
FROM python:3.12-slim AS build
WORKDIR /build
ENV PIP_NO_CACHE_DIR=1
COPY pyproject.toml ./
COPY src ./src
RUN pip install --prefix=/install ".[azure]"

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PORT=8000
COPY --from=build /install /usr/local
RUN useradd --system --uid 10001 --no-create-home app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import os,urllib.request as u; u.urlopen('http://localhost:'+os.environ['PORT']+'/health')"
CMD ["sh", "-c", "uvicorn agent_api.app:create_app --factory --host 0.0.0.0 --port ${PORT}"]
