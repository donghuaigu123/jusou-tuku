#!/usr/bin/env bash
# 聚搜图库 · 轻量构建脚本
# 不依赖 Gradle / Android Studio / AndroidX，只需要 Android SDK 的
# build-tools 与 platforms/android-35。
#
# 用法：
#   ANDROID_SDK_ROOT=/path/to/android-sdk bash scripts/build-apk.sh
#
# 流程：aapt2 compile/link（含 assets）→ javac → d8 → 打包 dex → zipalign → apksigner
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/opt/android-sdk}}"

# 自动挑选 build-tools 与 platform（优先 35.0.0 / android-35）
BT_DIR=""
for v in 35.0.0 34.0.0 36.0.0 33.0.2; do
  [ -x "$SDK/build-tools/$v/aapt2" ] && { BT_DIR="$SDK/build-tools/$v"; break; }
done
if [ -z "$BT_DIR" ]; then BT_DIR="$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)"; fi
PLATFORM=""
for v in android-35 android-34 android-36 android-33; do
  [ -f "$SDK/platforms/$v/android.jar" ] && { PLATFORM="$SDK/platforms/$v/android.jar"; break; }
done
if [ -z "$PLATFORM" ]; then PLATFORM="$(ls "$SDK"/platforms/*/android.jar 2>/dev/null | sort -V | tail -1)"; fi

for f in "$BT_DIR/aapt2" "$BT_DIR/d8" "$BT_DIR/zipalign" "$BT_DIR/apksigner" "$PLATFORM"; do
  [ -e "$f" ] || { echo "缺少：$f"; echo "请先安装：sdkmanager 'platforms;android-35' 'build-tools;35.0.0'"; exit 1; }
done

BUILD="$ROOT/build"
OUT="$ROOT/apk/jusou-tuku-v2.0.0.apk"
rm -rf "$BUILD"
mkdir -p "$BUILD/compiled" "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$ROOT/apk"

echo "[1/8] 准备签名密钥（放在 .keystore/ 本地复用，保证重复构建签名一致、可覆盖升级；不入库）"
KEYDIR="$ROOT/.keystore"
mkdir -p "$KEYDIR"
KEYSTORE="$KEYDIR/app.jks"
PASSFILE="$KEYDIR/keystore.pass"
if [ -f "$KEYSTORE" ] && [ -f "$PASSFILE" ]; then
  STORE_PASS="$(cat "$PASSFILE")"
else
  STORE_PASS="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  keytool -genkeypair -keystore "$KEYSTORE" -alias jusou \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$STORE_PASS" -keypass "$STORE_PASS" \
    -dname "CN=JuSou TuKu, OU=OpenSource, O=JuSou, L=CN, C=CN" >/dev/null 2>&1
  printf '%s' "$STORE_PASS" > "$PASSFILE"
fi

echo "[2/8] 编译资源"
"$BT_DIR/aapt2" compile --dir app/src/main/res -o "$BUILD/compiled/res.zip"

echo "[3/8] 链接资源、assets 并生成 R.java"
"$BT_DIR/aapt2" link -o "$BUILD/app-unsigned.apk" \
  -I "$PLATFORM" \
  --manifest app/src/main/AndroidManifest.xml \
  -R "$BUILD/compiled/res.zip" \
  -A app/src/main/assets \
  --java "$BUILD/gen" \
  --auto-add-overlay \
  --min-sdk-version 24 --target-sdk-version 35 \
  --version-code 2 --version-name 2.0.0

echo "[4/8] 编译 Java 源码"
find app/src/main/java "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac --release 8 -encoding UTF-8 -cp "$PLATFORM" -d "$BUILD/classes" @"$BUILD/sources.txt"

echo "[5/8] 转换为 DEX"
find "$BUILD/classes" -name '*.class' > "$BUILD/classes.txt"
"$BT_DIR/d8" --lib "$PLATFORM" --min-api 24 --output "$BUILD/dex" @"$BUILD/classes.txt"

echo "[6/8] 打包 DEX"
( cd "$BUILD/dex" && zip -q "$BUILD/app-unsigned.apk" classes.dex )

echo "[7/8] 对齐"
"$BT_DIR/zipalign" -f -p 4 "$BUILD/app-unsigned.apk" "$BUILD/app-aligned.apk"

echo "[8/8] 签名并校验"
"$BT_DIR/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$STORE_PASS" \
  --key-pass "pass:$STORE_PASS" --v1-signing-enabled true --v2-signing-enabled true \
  --v4-signing-enabled false \
  --out "$OUT" "$BUILD/app-aligned.apk"
"$BT_DIR/apksigner" verify --verbose "$OUT" | head -12

echo
echo "构建完成：$OUT"
ls -lh "$OUT"
