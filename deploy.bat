@echo off
cd /d D:\GitHub\Budget-Tracker
echo.
echo ========================================
echo   BudgetLog - Firebase Deploy
echo ========================================
echo.
echo Deploying to Firebase Hosting...
call firebase deploy --only hosting
echo.
if %ERRORLEVEL% == 0 (
    echo ========================================
    echo   Deploy successful!
    echo   https://budgetlog-b318d.web.app
    echo ========================================
) else (
    echo ========================================
    echo   Deploy FAILED. Check errors above.
    echo ========================================
)
echo.
pause
