@echo off
cd /d "%~dp0"
set LOG=%~dp0PUSH_LOG.txt

echo ==== Amethyst AI deploy log ==== > "%LOG%"
echo Started: %date% %time% >> "%LOG%"
echo Folder: %cd% >> "%LOG%"
echo. >> "%LOG%"

echo Building Amethyst AI...
echo ==== npm.cmd run build ==== >> "%LOG%"
call npm.cmd run build >> "%LOG%" 2>&1
if errorlevel 1 (
  echo Build failed. I saved the error to PUSH_LOG.txt
  echo BUILD_FAILED >> "%LOG%"
  pause
  exit /b 1
)

echo Pushing update to GitHub...
echo. >> "%LOG%"
echo ==== git status ==== >> "%LOG%"
git status --short >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ==== git add -A ==== >> "%LOG%"
git add -A >> "%LOG%" 2>&1
if errorlevel 1 (
  echo Git add failed. I saved the error to PUSH_LOG.txt
  echo GIT_ADD_FAILED >> "%LOG%"
  pause
  exit /b 1
)

echo. >> "%LOG%"
echo ==== git commit ==== >> "%LOG%"
git commit -m "Update landing and code access" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo Commit had no new files or failed. Trying git push anyway...
  echo COMMIT_SKIPPED_OR_FAILED >> "%LOG%"
)

echo. >> "%LOG%"
echo ==== git push origin main ==== >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
if errorlevel 1 (
  echo Push failed. I saved the error to PUSH_LOG.txt
  echo PUSH_FAILED >> "%LOG%"
  pause
  exit /b 1
)

echo. >> "%LOG%"
echo DONE >> "%LOG%"
echo Done. Vercel will redeploy https://rift-ai-kzjh.vercel.app
pause
