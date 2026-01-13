#!/bin/bash

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Run setup.sh first."
    exit 1
fi

source venv/bin/activate

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

case "$1" in
    sync)
        echo "Starting blockchain sync..."
        python sync.py
        ;;
    sync-once)
        echo "Running single sync..."
        python sync.py --once
        ;;
    web)
        echo "Starting web server on port 5000..."
        python app.py
        ;;
    production)
        echo "Starting production server..."
        gunicorn -w 4 -b 0.0.0.0:5000 app:app
        ;;
    *)
        echo "Usage: $0 {sync|sync-once|web|production}"
        echo ""
        echo "  sync       - Start continuous blockchain sync"
        echo "  sync-once  - Run sync once and exit"
        echo "  web        - Start development web server"
        echo "  production - Start production server with gunicorn"
        exit 1
        ;;
esac
