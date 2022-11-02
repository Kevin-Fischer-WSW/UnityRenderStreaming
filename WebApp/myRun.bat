@echo off
pushd %~dp0
call npm run build
call npm run start -- -w -h "C:\Users\Kevin\Desktop\Holding Slides" -r "C:\Users\Kevin\Desktop\Recordings" -u "C:\Users\Kevin\Desktop\Holding Music" -v "C:\Users\Kevin\Desktop\Holding Slides\Custom Videos"
popd
pause
