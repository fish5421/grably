# Changelog

All notable changes to Grably Desktop will be documented in this file.

## [0.1.1] - 2025-09-26

### 🎉 Major Fixes
- **Fixed YouTube 403 Forbidden errors** - Updated yt-dlp from 2025.09.23 to 2025.09.26
- **Resolved YouTube transcription failures** - Both regular downloads and Whisper transcription now work perfectly
- **Added proper macOS code signing** - All binaries now signed with entitlements for production distribution

### ✅ What's Working Now
- ✅ YouTube video downloads (no more 403 errors)
- ✅ YouTube audio transcription with Whisper
- ✅ Facebook, Instagram, and other social media downloads
- ✅ Proper sandbox permissions for bundled binaries
- ✅ Production-ready DMG with Applications folder

### 🔧 Technical Changes
- Updated yt-dlp binary to version 2025.09.26 (35.7MB universal binary)
- Removed temporary YouTube 403 workarounds (clean code)
- Added entitlements.plist with `com.apple.security.cs.disable-library-validation`
- Restored social media download headers for compatibility
- Fixed sandbox permission violations with shell execution rights

### 🛡️ Security & Distribution
- All binaries properly signed with Developer ID Application certificate
- Added hardened runtime and timestamping for all components
- Created production-ready signed DMG for distribution
- Fixed library loading issues in production builds

### 📦 Binary Updates
- **yt-dlp**: 2025.09.23 → 2025.09.26 (fixes YouTube API changes)
- **ffmpeg**: Properly signed with entitlements
- **whisper.cpp**: Properly signed with entitlements

### 🐛 Bug Fixes
- Fixed corrupted yt-dlp binary (was pyenv wrapper script)
- Resolved "different Team IDs" signing errors
- Fixed macOS sandbox violations blocking resource access
- Eliminated YouTube "tv_simply client" errors

---

## [0.1.0] - 2025-09-xx

### Initial Release
- Basic YouTube video downloading
- Whisper.cpp integration for transcription
- Social media platform support
- Tauri 2.x desktop application framework