#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="calculus"
PROJECT_FILE="$SCRIPT_DIR/Calculus.csproj"
BUNDLE_DIR="$SCRIPT_DIR/publish"
STAGE_ZIP="/srv/stage/${APP_NAME}.zip"
APP_SERVICE="deployd-${APP_NAME}.service"
PUBLIC_URL="http://hasta-home.com/Calculus/"
VERSION_FILE="$SCRIPT_DIR/version.txt"
DATA_DIR="/srv/www/data/calculus"
DOTNET_BIN="${DOTNET_BIN:-dotnet}"

CURRENT_VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
if [[ ! "$CURRENT_VERSION" =~ ^[0-9]+$ ]]; then
    echo "version.txt must contain a single integer." >&2
    exit 1
fi
NEXT_VERSION="$((CURRENT_VERSION + 1))"

echo "[1/6] Building project..."
"$DOTNET_BIN" build "$PROJECT_FILE" -c Release

echo "[2/6] Publishing project..."
rm -rf "$BUNDLE_DIR"
"$DOTNET_BIN" publish "$PROJECT_FILE" -c Release -o "$BUNDLE_DIR"
cp "$SCRIPT_DIR/calculus.ini" "$BUNDLE_DIR/calculus.ini"
cp "$SCRIPT_DIR/calculus.caddy" "$BUNDLE_DIR/calculus.caddy"
printf '%s\n' "$NEXT_VERSION" > "$BUNDLE_DIR/version.txt"
find "$BUNDLE_DIR/wwwroot" -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.webmanifest' \) -exec sed -i "s/__APP_VERSION__/$NEXT_VERSION/g" {} +

echo "[3/6] Creating deployment zip..."
rm -f "$STAGE_ZIP"
(
    cd "$BUNDLE_DIR"
    zip -qr "$STAGE_ZIP" .
)

echo "[4/6] Waiting for deployd to consume the zip..."
for attempt in {1..60}; do
    if [[ ! -f "$STAGE_ZIP" ]]; then
        echo "deployd consumed the zip after ${attempt}s."
        break
    fi
    sleep 1
done
if [[ -f "$STAGE_ZIP" ]]; then
    echo "deployd did not consume $STAGE_ZIP in time." >&2
    exit 1
fi

echo "[5/6] Configuring persistent log storage..."
mkdir -p "$DATA_DIR"
UNIT_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$APP_SERVICE"
if [[ ! -f "$UNIT_FILE" ]]; then
    echo "Deployd did not create $UNIT_FILE." >&2
    exit 1
fi
if grep -q '^Environment=CALCULUS_DATA=' "$UNIT_FILE"; then
    sed -i "s|^Environment=CALCULUS_DATA=.*|Environment=CALCULUS_DATA=$DATA_DIR|" "$UNIT_FILE"
else
    sed -i "/^Environment=DEPLOYD_APP_ROOT=/a Environment=CALCULUS_DATA=$DATA_DIR" "$UNIT_FILE"
fi
systemctl --user daemon-reload
systemctl --user restart "$APP_SERVICE"

echo "[6/6] Finalizing version..."
printf '%s\n' "$NEXT_VERSION" > "$VERSION_FILE"

echo "Deployd logs:   tail -n 20 /srv/deployd/logs/deployments.log"
echo "Service status: systemctl --user status $APP_SERVICE --no-pager"
echo "Service logs:   journalctl --user -u $APP_SERVICE -n 50 --no-pager"
echo "Public check:   curl -I $PUBLIC_URL"
echo "Deployed version: $NEXT_VERSION"
