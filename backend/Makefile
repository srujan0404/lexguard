.PHONY: install install-dev dev test lint fmt clean

PYTHON ?= python3
VENV   ?= .venv
PIP    := $(VENV)/bin/pip
UV     := $(VENV)/bin/uvicorn
PYTEST := $(VENV)/bin/pytest
RUFF   := $(VENV)/bin/ruff

$(VENV)/bin/activate:
	$(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip

install: $(VENV)/bin/activate
	$(PIP) install -r requirements.txt

install-dev: $(VENV)/bin/activate
	$(PIP) install -r requirements-dev.txt

dev:
	$(UV) app.main:app --reload --host 0.0.0.0 --port 8000

test:
	$(PYTEST)

lint:
	$(RUFF) check app tests

fmt:
	$(RUFF) format app tests
	$(RUFF) check --fix app tests

clean:
	rm -rf $(VENV) .pytest_cache .ruff_cache __pycache__ app/__pycache__ app/*/__pycache__ tests/__pycache__
