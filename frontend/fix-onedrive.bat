@echo off
echo Creating junction to move .next outside OneDrive...

:: Delete any broken .next folder first
if exist "C:\Users\Kartik\OneDrive\Desktop\Speak\Speak-AI\frontend\.next" (
    rmdir /s /q "C:\Users\Kartik\OneDrive\Desktop\Speak\Speak-AI\frontend\.next"
)

:: Create real build folder outside OneDrive
if not exist "C:\speak-next-cache" mkdir "C:\speak-next-cache"

:: Create junction: .next in project -> C:\speak-next-cache (outside OneDrive)
mklink /J "C:\Users\Kartik\OneDrive\Desktop\Speak\Speak-AI\frontend\.next" "C:\speak-next-cache"

echo.
echo Done! .next is now a junction pointing to C:\speak-next-cache
echo Now run: npm run dev
pause
