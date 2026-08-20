@echo off
cd /d "%~dp0backend"
echo Starting server + WhatsApp bot...
start "" /min cmd /c "node server.js > server.log 2>&1"
start "" /min cmd /c "node wa-bot.js > bot.log 2>&1"
echo Started. Site: http://localhost:3000  |  Admin: http://localhost:3000/admin.html
ping -n 3 127.0.0.1 > nul
start http://localhost:3000
exit