#!/bin/sh
set -e

echo "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"; do
  sleep 1
done

echo "PostgreSQL is ready. Running migrations..."
python manage.py migrate --noinput

PORT="${PORT:-8000}"
echo "Starting Django server on 0.0.0.0:${PORT}..."
exec python manage.py runserver "0.0.0.0:${PORT}"
