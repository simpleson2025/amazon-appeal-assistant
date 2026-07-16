@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo ======Git auto======
echo.

git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未找到Git，请安装并配置环境变量
    goto end
)

echo [1/3]查看文件变更
git status -s
echo.

set commit_msg=
set /p commit_msg=输入提交备注：
if "!commit_msg!"=="" set commit_msg=自动更新 !date! !time!

echo [2/3]本地提交
git add .
git commit -m "!commit_msg!"

echo [3/3]推送到远程
git push origin main

:end
echo 操作结束
pause
endlocal