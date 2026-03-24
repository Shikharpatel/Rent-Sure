Write-Output "Starting git operations with OneDrive delay..."
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

git fetch origin main
Start-Sleep -Seconds 5
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue

git reset --hard origin/main
Start-Sleep -Seconds 5
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue

Copy-Item ..\temp_README.md README.md -Force
Copy-Item ..\temp_DEVPLAN.md DEVELOPMENT_PLAN.md -Force
git add README.md DEVELOPMENT_PLAN.md
Start-Sleep -Seconds 5
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue

git commit -m "docs: rename old README and create proper README for github"
Start-Sleep -Seconds 5
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue

git push origin main
Start-Sleep -Seconds 5
Write-Output "Finished!"
