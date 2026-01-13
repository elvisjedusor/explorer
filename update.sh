#!/bin/bash

set -e

BITOK_DIR="/root/bitok"
EXPLORER_DIR="/root/explorer"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root (sudo ./update.sh)"
        exit 1
    fi
}

stop_services() {
    log_info "Stopping services..."

    if systemctl is-active --quiet bitok-sync.service; then
        systemctl stop bitok-sync.service
        log_info "Stopped bitok-sync"
    fi

    if systemctl is-active --quiet bitok-explorer.service; then
        systemctl stop bitok-explorer.service
        log_info "Stopped bitok-explorer"
    fi

    if systemctl is-active --quiet bitokd.service; then
        systemctl stop bitokd.service
        sleep 5
        log_info "Stopped bitokd"
    fi
}

pull_updates() {
    log_info "Pulling latest code..."
    cd "$BITOK_DIR"
    git fetch origin
    git pull origin main
    log_info "Code updated"
}

rebuild_daemon() {
    log_info "Rebuilding daemon..."
    cd "$BITOK_DIR"

    make -f makefile.unix clean 2>/dev/null || true
    make -f makefile.unix -j$(nproc)

    if [ -f "bitokd" ]; then
        log_info "Daemon built successfully"
    else
        log_error "Build failed!"
        exit 1
    fi
}

update_explorer_files() {
    log_info "Updating explorer files..."

    cp "$BITOK_DIR"/explorer/*.py "$EXPLORER_DIR/" 2>/dev/null || true
    cp -r "$BITOK_DIR"/explorer/templates/* "$EXPLORER_DIR/templates/" 2>/dev/null || true
    cp -r "$BITOK_DIR"/explorer/static/* "$EXPLORER_DIR/static/" 2>/dev/null || true

    log_info "Explorer files updated"
}

update_python_deps() {
    log_info "Updating Python dependencies..."
    cd "$EXPLORER_DIR"

    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
        pip install -r "$BITOK_DIR/explorer/requirements.txt" --quiet
        deactivate
        log_info "Python dependencies updated"
    else
        log_warn "No virtualenv found at $EXPLORER_DIR/venv"
    fi
}

start_services() {
    log_info "Starting services..."

    systemctl start bitokd.service
    sleep 10
    log_info "Started bitokd"

    systemctl start bitok-explorer.service
    log_info "Started bitok-explorer"

    systemctl start bitok-sync.service
    log_info "Started bitok-sync"
}

check_status() {
    echo ""
    echo "Service Status:"
    echo "---------------"

    if systemctl is-active --quiet bitokd.service; then
        echo -e "bitokd:          ${GREEN}RUNNING${NC}"
    else
        echo -e "bitokd:          ${RED}STOPPED${NC}"
    fi

    if systemctl is-active --quiet bitok-explorer.service; then
        echo -e "bitok-explorer:  ${GREEN}RUNNING${NC}"
    else
        echo -e "bitok-explorer:  ${RED}STOPPED${NC}"
    fi

    if systemctl is-active --quiet bitok-sync.service; then
        echo -e "bitok-sync:      ${GREEN}RUNNING${NC}"
    else
        echo -e "bitok-sync:      ${RED}STOPPED${NC}"
    fi

    echo ""
}

main() {
    echo ""
    echo "================================"
    echo "  Bitok Explorer Update Script"
    echo "================================"
    echo ""

    check_root
    stop_services
    pull_updates
    rebuild_daemon
    update_explorer_files
    update_python_deps
    start_services
    check_status

    log_info "Update complete!"
}

case "${1:-}" in
    --help|-h)
        echo "Usage: sudo ./update.sh [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h       Show this help"
        echo "  --status         Only check service status"
        echo "  --explorer-only  Update only explorer (skip daemon rebuild)"
        echo "  --daemon-only    Update only daemon (skip explorer)"
        ;;
    --status)
        check_status
        ;;
    --explorer-only)
        check_root
        stop_services
        pull_updates
        update_explorer_files
        update_python_deps
        start_services
        check_status
        log_info "Explorer update complete!"
        ;;
    --daemon-only)
        check_root
        stop_services
        pull_updates
        rebuild_daemon
        start_services
        check_status
        log_info "Daemon update complete!"
        ;;
    *)
        main
        ;;
esac
