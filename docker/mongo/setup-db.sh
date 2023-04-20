#!/bin/bash

mongod --bind_ip_all --fork --syslog

sleep 5

cat /tmp/mongo.script | mongosh

pkill -9 mongod

mongod --bind_ip_all