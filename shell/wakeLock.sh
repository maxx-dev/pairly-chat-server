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
       activator send libactivator.system.homebutton & activator send libactivator.system.homebutton # Unlock
    fi

    sleep 1

    if [ "$APP_TYPE" == "IOS" ]; then
      activator send com.modrena.pairlychat
    fi

    if [ "$APP_TYPE" == "PWA" ]; then
      activator send com.apple.webapp
    fi
    sleep 12
    activator send libactivator.system.sleepbutton
    sleep 10
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
   isoDate=$(date --iso-8601=seconds)
   printf "$isoDate RUN $c\n"
   run
done