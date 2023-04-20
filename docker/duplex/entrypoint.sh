#!/bin/bash

cd ~

echo "$SIP_ACCOUNT" > baresip/accounts

echo "Starting pulseaudio ..."
pulseaudio -D --exit-idle-time=-1

sleep 1

echo "Creating pulseaudio devices ..."
pactl load-module module-null-sink sink_name=baresip_alert sink_properties=device.description=baresip_alert
pactl load-module module-null-sink sink_name=baresip_ringer sink_properties=device.description=baresip_ringer
pactl load-module module-null-sink sink_name=oracle_playback sink_properties=device.description=oracle_playback
sleep 1
pactl load-module module-remap-source master=oracle_playback.monitor source_name=baresip_capture source_properties=device.description=baresip_capture
pactl load-module module-null-sink sink_name=baresip_playback sink_properties=device.description=baresip_playback
pactl load-module module-remap-source master=baresip_playback.monitor source_name=oracle_capture source_properties=device.description=oracle_capture

pactl load-module module-null-sink sink_name=combined sink_properties=device.description="combined"
sleep 1
pactl load-module module-loopback source=oracle_capture sink=combined 
pactl load-module module-loopback source=baresip_capture sink=combined

echo "Build speech-engine ..."
cd speech-engine && npm install

echo "Starting conversation engine ..."
nohup npx tsx . &

cd ~

echo "Starting baresip and greeter daemon ..."
./duplex-baresip
