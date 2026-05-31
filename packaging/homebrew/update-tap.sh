#!/usr/bin/env bash
#
# Render the multi-platform Homebrew formula for a given version and push it to
# the tap repo. Called by the publish workflow; also usable locally to bootstrap.
#
# Usage: TAP_TOKEN=<gh-pat> packaging/homebrew/update-tap.sh <version> <dir-with-binaries>
#   <dir-with-binaries> must contain insurup-darwin-arm64, insurup-darwin-x64,
#   insurup-linux-arm64, insurup-linux-x64.
set -euo pipefail

VERSION="${1:?version required (e.g. 0.1.1)}"
OUT="${2:?binaries dir required}"
TAP_REPO="${TAP_REPO:-InsurUp/homebrew-insurup}"
: "${TAP_TOKEN:?TAP_TOKEN required}"

sha() { sha256sum "$OUT/$1" | cut -d' ' -f1; }
DARWIN_ARM=$(sha insurup-darwin-arm64)
DARWIN_X64=$(sha insurup-darwin-x64)
LINUX_ARM=$(sha insurup-linux-arm64)
LINUX_X64=$(sha insurup-linux-x64)

workdir="$(mktemp -d)"
git clone --depth 1 "https://x-access-token:${TAP_TOKEN}@github.com/${TAP_REPO}.git" "$workdir"
mkdir -p "$workdir/Formula"

base="https://github.com/InsurUp/cli/releases/download/v${VERSION}"
cat > "$workdir/Formula/cli.rb" <<RUBY
class Cli < Formula
  desc "Command-line interface for the InsurUp insurance platform"
  homepage "https://github.com/InsurUp/cli"
  version "${VERSION}"
  license "MIT"

  on_macos do
    on_arm do
      url "${base}/insurup-darwin-arm64"
      sha256 "${DARWIN_ARM}"
    end
    on_intel do
      url "${base}/insurup-darwin-x64"
      sha256 "${DARWIN_X64}"
    end
  end

  on_linux do
    on_arm do
      url "${base}/insurup-linux-arm64"
      sha256 "${LINUX_ARM}"
    end
    on_intel do
      url "${base}/insurup-linux-x64"
      sha256 "${LINUX_X64}"
    end
  end

  def install
    bin.install Dir["insurup-*"].first => "insurup"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/insurup --version")
  end
end
RUBY

cd "$workdir"
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add Formula/cli.rb
if git diff --staged --quiet; then
  echo "Formula already up to date for ${VERSION}"
else
  git commit -m "cli ${VERSION}"
  git push
fi
