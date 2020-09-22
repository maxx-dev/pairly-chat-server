#!/bin/bash
# Example ./run.sh IOS 10 WARM, ./run.sh PWA 10 WARM
APP_TYPE=$1 # [IOS,PWA]
RUNS=$2 # Number
LAUNCH_MODE=$3 # [WARM, HOT]

run ()
{
    if [ "$LAUNCH_MODE" == "WARM" ]; then
       killApps
    fi
    if [ "$LAUNCH_MODE" == "HOT" ]; then
       activator send libactivator.system.homebutton # Go to home screen
    fi
    LAUNCH_TIME=$(($(date +%s%N)/1000000))
    curl -s -o /dev/null -w "StatusCode: %{http_code}\n" -k -X POST https://chat.pairly.app/api/dashboard/appMetric -d '{"appType":"'$APP_TYPE'","title":"LAUNCH_TIME","end":"'$LAUNCH_TIME'"}' -H "Content-Type: application/json"
    echo $
    if [ "$APP_TYPE" == "IOS" ]; then
      activator send com.modrena.pairlychat
    fi

    if [ "$APP_TYPE" == "PWA" ]; then
      activator send com.apple.webapp
    fi
    sleep 3
}

killApps ()
{
  printf "Kill Apps \n"
  killall -9 "Pairly" 2> /dev/null
  killall -9 "Web" 2> /dev/null
}

START=1
for (( c=$START; c<=$RUNS; c++ ))
do
   printf "____________________________________\n"
   printf "RUN $c\n"
   run
done