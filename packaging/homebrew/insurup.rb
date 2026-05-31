# Reference Homebrew formula for the InsurUp CLI.
#
# In a real tap (InsurUp/homebrew-insurup) the release workflow keeps the URLs
# and sha256 values up to date. The CLI is a self-contained binary, so Homebrew
# just downloads the right artifact for the platform — no Bun runtime required.
class Insurup < Formula
  desc "Command-line interface for the InsurUp insurance platform"
  homepage "https://github.com/InsurUp/cli"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/InsurUp/cli/releases/download/v#{version}/insurup-darwin-arm64"
      sha256 "REPLACED_BY_RELEASE_WORKFLOW"
    end
    on_intel do
      url "https://github.com/InsurUp/cli/releases/download/v#{version}/insurup-darwin-x64"
      sha256 "REPLACED_BY_RELEASE_WORKFLOW"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/InsurUp/cli/releases/download/v#{version}/insurup-linux-arm64"
      sha256 "REPLACED_BY_RELEASE_WORKFLOW"
    end
    on_intel do
      url "https://github.com/InsurUp/cli/releases/download/v#{version}/insurup-linux-x64"
      sha256 "REPLACED_BY_RELEASE_WORKFLOW"
    end
  end

  def install
    bin.install Dir["insurup-*"].first => "insurup"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/insurup --version")
  end
end
