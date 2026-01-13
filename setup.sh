#!/bin/bash
set -e

echo "==================================="
echo "Bitok Explorer Setup"
echo "==================================="

if ! command -v python3 &> /dev/null; then
    echo "Python3 not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv
fi

echo ""
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo ""
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "Creating .env file template..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
BITOK_RPC_HOST=127.0.0.1
BITOK_RPC_PORT=8332
BITOK_RPC_USER=yourusername
BITOK_RPC_PASSWORD=yourpassword

# SQLite (default - no setup needed)
DATABASE_URL=sqlite:///bitok_explorer.db

# PostgreSQL (optional - uncomment and configure)
# DATABASE_URL=postgresql://user:password@localhost/bitok_explorer

SECRET_KEY=change-this-to-a-random-string

SYNC_INTERVAL=10
ITEMS_PER_PAGE=50
DEBUG=false
EOF
    echo "Created .env file. Please edit it with your settings."
else
    echo ".env file already exists."
fi

echo ""
echo "==================================="
echo "Setup complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Edit .env with your Bitok daemon RPC credentials"
echo "2. Start bitokd with RPC enabled:"
echo "   ./bitokd -rpcuser=yourusername -rpcpassword=yourpassword -server -daemon"
echo ""
echo "3. Start the blockchain sync (in background):"
echo "   source venv/bin/activate"
echo "   python sync.py &"
echo ""
echo "4. Start the web explorer:"
echo "   source venv/bin/activate"
echo "   python app.py"
echo "   # Or for production:"
echo "   gunicorn -w 4 -b 0.0.0.0:5000 app:app"
echo ""
echo "The explorer will be available at http://localhost:5000"
